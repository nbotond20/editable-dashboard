import type { DashboardAction, DashboardState, ComputedLayout } from "../types.ts";
import type {
  DragEvent,
  DragPhase,
  DropZone,
  OperationIntent,
  CommittedOperation,
  DragEngineConfig,
  DragEngineSnapshot,
  Point,
} from "./types.ts";
import { distance, getVisibleSorted, zonesEqual } from "./types.ts";
import { resolveZone } from "./zone-resolver.ts";
import { resolveIntent, computeDwellProgress } from "./intent-resolver.ts";
import { applyOperation } from "./operation-applier.ts";
import {
  solveBaseLayout,
  solveDragLayout,
  solvePreviewLayout,
  stabilizeUninvolvedWidgets,
} from "./layout-solver.ts";
import type { LayoutSolverConfig } from "./layout-solver.ts";
import { dashboardReducer } from "../state/dashboard-reducer.ts";
import {
  createUndoHistory,
  pushState,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
} from "../state/undo-history.ts";
import type { UndoHistory } from "../state/undo-history.ts";
import {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  DRAG_ACTIVATION_THRESHOLD,
  TOUCH_DRAG_ACTIVATION_DELAY,
  TOUCH_MOVE_TOLERANCE,
  SWAP_DWELL_MS,
  RESIZE_DWELL_MS,
  DROP_ANIMATION_DURATION,
} from "../constants.ts";

const UNDOABLE_ACTIONS = new Set<string>([
  "ADD_WIDGET",
  "REMOVE_WIDGET",
  "REORDER_WIDGETS",
  "RESIZE_WIDGET",
  "SWAP_WIDGETS",
  "TOGGLE_VISIBILITY",
  "BATCH_UPDATE",
  "SET_MAX_COLUMNS",
]);

const MAX_UNDO_DEPTH = 50;

function defaultConfig(): DragEngineConfig {
  return {
    activationThreshold: DRAG_ACTIVATION_THRESHOLD,
    touchActivationDelay: TOUCH_DRAG_ACTIVATION_DELAY,
    touchMoveTolerance: TOUCH_MOVE_TOLERANCE,
    swapDwellMs: SWAP_DWELL_MS,
    resizeDwellMs: RESIZE_DWELL_MS,
    autoFillMode: "on-drop",
    maxColumns: DEFAULT_MAX_COLUMNS,
    gap: DEFAULT_GAP,
    dropAnimationDuration: DROP_ANIMATION_DURATION,
    isLocked: () => false,
    canDrop: () => true,
    getWidgetConstraints: () => ({ minSpan: 1, maxSpan: Infinity }),
  };
}

export class DragEngine {
  private history: UndoHistory<DashboardState>;
  private config: DragEngineConfig;
  private phase: DragPhase = { type: "idle" };
  private heights: ReadonlyMap<string, number> = new Map();
  private containerWidth = 0;
  // containerRect removed — unused by the engine (adapter tracks it locally)

  // Zone tracking
  private currentZone: DropZone | null = null;
  private zoneEnteredAt = 0;
  private currentIntent: OperationIntent | null = null;

  // Zone debounce (2-frame buffer like the old system)
  private pendingZone: DropZone | null = null;
  private pendingZoneFrames = 0;

  // Layout caches
  private baseLayout: ComputedLayout = { positions: new Map(), totalHeight: 0 };
  private dragLayout: ComputedLayout | null = null;
  private previewLayout: ComputedLayout | null = null;

  // Layout input cache (to avoid recomputing when inputs are identical)
  private lastLayoutInputs: {
    widgets: readonly import("../types.ts").WidgetState[];
    heights: ReadonlyMap<string, number>;
    containerWidth: number;
    maxColumns: number;
    gap: number;
    autoFillMode: string;
  } | null = null;

  // Announcement
  private announcement: string | null = null;

  // Subscribers
  private listeners = new Set<() => void>();
  private cachedSnapshot: DragEngineSnapshot | null = null;

  constructor(
    initialState: DashboardState,
    config?: Partial<DragEngineConfig>,
  ) {
    this.config = { ...defaultConfig(), ...config };
    this.history = createUndoHistory(initialState);
    this.containerWidth = initialState.containerWidth;
    this.recomputeBaseLayout();
  }

  // ─── Public API (arrow properties for stable `this`) ───────

  send = (event: DragEvent): void => {
    this.announcement = null;

    // Save previous snapshot reference for change detection
    const prevSnapshot = this.cachedSnapshot;
    this.cachedSnapshot = null;

    switch (event.type) {
      case "POINTER_DOWN":
        this.handlePointerDown(event);
        break;
      case "POINTER_MOVE":
        this.handlePointerMove(event);
        break;
      case "POINTER_UP":
        this.handlePointerUp(event);
        break;
      case "POINTER_CANCEL":
        this.handlePointerCancel();
        break;
      case "KEY_PICKUP":
        this.handleKeyPickup(event);
        break;
      case "KEY_MOVE":
        this.handleKeyMove(event);
        break;
      case "KEY_RESIZE":
        this.handleKeyResize(event);
        break;
      case "KEY_DROP":
        this.handleKeyDrop();
        break;
      case "KEY_CANCEL":
        this.handleKeyCancel();
        break;
      case "CANCEL":
        this.handleCancel();
        break;
      case "TICK":
        this.handleTick(event);
        break;
      case "RESIZE_TOGGLE":
        this.handleResizeToggle(event);
        break;
      case "SET_HEIGHTS":
        this.heights = event.heights;
        this.recomputeLayouts();
        break;
      case "SET_CONTAINER":
        this.containerWidth = event.width;
        this.recomputeLayouts();
        break;
    }

    // Only notify subscribers if the snapshot actually changed.
    // This prevents useSyncExternalStore from forcing unnecessary
    // re-renders (which can cause infinite loops when effects send
    // events back to the engine).
    const newSnapshot = this.getSnapshot();
    if (prevSnapshot && this.snapshotsEqual(prevSnapshot, newSnapshot)) {
      // Nothing that React cares about changed. Preserve the old
      // reference so useSyncExternalStore sees no change and skips
      // re-rendering. Only do this when truly identical — if a
      // non-rendered field like dwellProgress changed, keep the fresh
      // snapshot so direct callers of getSnapshot() see current values.
      if (prevSnapshot.dwellProgress === newSnapshot.dwellProgress) {
        this.cachedSnapshot = prevSnapshot;
      }
    } else {
      this.notify();
    }
  }

  getSnapshot = (): DragEngineSnapshot => {
    if (this.cachedSnapshot) return this.cachedSnapshot;

    const state = this.history.present;
    const phase = this.phase;

    let dragPosition: Point | null = null;
    if (phase.type === "dragging") {
      dragPosition = {
        x: phase.pointerPos.x - phase.grabOffset.x,
        y: phase.pointerPos.y - phase.grabOffset.y,
      };
    }

    const dwellMs =
      phase.type === "dragging" && this.currentZone
        ? this.lastTimestamp - this.zoneEnteredAt
        : 0;

    this.cachedSnapshot = {
      phase,
      // Always expose baseLayout (includes ALL widgets). dragLayout is
      // an internal detail for zone/intent computation — it uses phantoms
      // or excludes the source widget, which would make it disappear.
      layout: this.baseLayout,
      previewLayout: this.previewLayout,
      intent: this.currentIntent,
      zone: this.currentZone,
      dragPosition,
      announcement: this.announcement,
      widgets: state.widgets,
      dwellProgress:
        this.currentZone
          ? computeDwellProgress(
              this.currentZone,
              dwellMs,
              this.config.swapDwellMs,
              this.config.resizeDwellMs,
            )
          : 0,
      canUndo: canUndo(this.history),
      canRedo: canRedo(this.history),
    };

    return this.cachedSnapshot;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch = (action: DashboardAction): void => {
    this.cachedSnapshot = null;

    if (action.type === "UNDO") {
      this.history = undoHistory(this.history);
      this.recomputeLayouts();
      this.notify();
      return;
    }
    if (action.type === "REDO") {
      this.history = redoHistory(this.history);
      this.recomputeLayouts();
      this.notify();
      return;
    }

    const newState = dashboardReducer(this.history.present, action);
    if (newState === this.history.present) return;

    if (UNDOABLE_ACTIONS.has(action.type)) {
      this.history = pushState(this.history, newState, MAX_UNDO_DEPTH);
    } else {
      this.history = { ...this.history, present: newState };
    }

    this.recomputeLayouts();
    this.notify();
  }

  /** Read the current drag position directly from the phase, bypassing the
   *  snapshot cache. This is called 60fps by the WidgetSlot RAF loop and
   *  MUST always return the latest pointer position. */
  getDragPosition = (): Point | null => {
    if (this.phase.type !== "dragging") return null;
    return {
      x: this.phase.pointerPos.x - this.phase.grabOffset.x,
      y: this.phase.pointerPos.y - this.phase.grabOffset.y,
    };
  }

  getState = (): DashboardState => {
    return this.history.present;
  }

  updateConfig(partial: Partial<DragEngineConfig>): void {
    this.config = { ...this.config, ...partial };
    this.cachedSnapshot = null;
    this.recomputeLayouts();
    // No notify() — config changes come from React props which already
    // trigger re-renders. useSyncExternalStore calls getSnapshot() each
    // render and picks up the new layout automatically.
  }

  destroy(): void {
    this.listeners.clear();
  }

  // ─── Timestamp tracking ──────────────────────────────────────

  private lastTimestamp = 0;

  // ─── FSM Event Handlers ──────────────────────────────────────

  private handlePointerDown(
    event: Extract<DragEvent, { type: "POINTER_DOWN" }>,
  ): void {
    if (this.phase.type !== "idle") return;
    if (this.config.isLocked(event.id)) return;

    this.lastTimestamp = event.timestamp;
    this.phase = {
      type: "pending",
      sourceId: event.id,
      startPos: event.position,
      startTime: event.timestamp,
      pointerType: event.pointerType,
      cumulativeDistance: 0,
    };
  }

  private handlePointerMove(
    event: Extract<DragEvent, { type: "POINTER_MOVE" }>,
  ): void {
    this.lastTimestamp = event.timestamp;

    if (this.phase.type === "pending") {
      this.handlePendingMove(event);
    } else if (this.phase.type === "dragging") {
      this.handleDraggingMove(event);
    }
  }

  private handlePendingMove(
    event: Extract<DragEvent, { type: "POINTER_MOVE" }>,
  ): void {
    if (this.phase.type !== "pending") return;
    const phase = this.phase;

    const dist = distance(event.position, phase.startPos);

    if (phase.pointerType === "touch") {
      // Touch: check if user moved too far (scrolling intent)
      const cumulative = phase.cumulativeDistance + dist;
      if (cumulative > this.config.touchMoveTolerance) {
        this.phase = { type: "idle" };
        this.clearDragState();
        return;
      }
      this.phase = { ...phase, cumulativeDistance: cumulative };
    } else {
      // Mouse/pen: activate on distance threshold
      if (dist >= this.config.activationThreshold) {
        this.activateDrag(phase.sourceId, event.position, phase.startPos);
      }
    }
  }

  private handleDraggingMove(
    event: Extract<DragEvent, { type: "POINTER_MOVE" }>,
  ): void {
    if (this.phase.type !== "dragging") return;

    // Only store the pointer position. Zone/intent computation happens
    // in handleTick (once per RAF frame), not on every pointer event.
    // This keeps POINTER_MOVE near-instant on the main thread.
    this.phase = {
      ...this.phase,
      pointerPos: event.position,
    };
  }

  private handlePointerUp(
    event: Extract<DragEvent, { type: "POINTER_UP" }>,
  ): void {
    this.lastTimestamp = event.timestamp;

    if (this.phase.type === "pending") {
      this.phase = { type: "idle" };
      this.clearDragState();
      return;
    }

    if (this.phase.type !== "dragging") return;

    const sourceId = this.phase.sourceId;
    const intent = this.currentIntent;

    if (!intent || intent.type === "none") {
      this.phase = { type: "idle" };
      this.clearDragState();
      this.announcement = "Drop cancelled";
      return;
    }

    // Commit the operation
    const committed = this.commitIntent(sourceId, intent);
    let newState = applyOperation(this.history.present, committed);

    // Pin uninvolved widgets to their current columns so they don't reflow
    const involvedIds = this.getInvolvedIds(sourceId, committed);
    const cfg = this.layoutConfig();
    newState = {
      ...newState,
      widgets: stabilizeUninvolvedWidgets(
        newState.widgets,
        this.baseLayout,
        involvedIds,
        this.containerWidth,
        cfg.maxColumns,
        cfg.gap,
      ),
    };

    if (newState !== this.history.present) {
      this.history = pushState(this.history, newState, MAX_UNDO_DEPTH);
    }

    this.phase = {
      type: "dropping",
      sourceId,
      operation: committed,
      startTime: event.timestamp,
    };

    this.currentZone = null;
    this.currentIntent = null;
    this.previewLayout = null;
    this.recomputeLayouts();

    this.announcement = this.buildDropAnnouncement(committed);
  }

  private handlePointerCancel(): void {
    if (this.phase.type === "pending" || this.phase.type === "dragging") {
      this.phase = { type: "idle" };
      this.clearDragState();
      this.announcement = "Drag cancelled";
    }
  }

  private handleKeyPickup(
    event: Extract<DragEvent, { type: "KEY_PICKUP" }>,
  ): void {
    if (this.phase.type !== "idle") return;
    if (this.config.isLocked(event.id)) return;

    const visible = getVisibleSorted(this.history.present.widgets);
    const idx = visible.findIndex((w) => w.id === event.id);
    if (idx === -1) return;

    const widget = visible[idx];

    this.lastTimestamp = event.timestamp;
    this.phase = {
      type: "keyboard-dragging",
      sourceId: event.id,
      currentIndex: idx,
      originalIndex: idx,
      currentColSpan: widget.colSpan,
      originalColSpan: widget.colSpan,
    };

    this.announcement = `Picked up widget at position ${idx + 1} of ${visible.length}. Use arrow keys to move, Space to drop, Escape to cancel.`;
  }

  private handleKeyMove(
    event: Extract<DragEvent, { type: "KEY_MOVE" }>,
  ): void {
    if (this.phase.type !== "keyboard-dragging") return;
    this.lastTimestamp = event.timestamp;

    const visible = getVisibleSorted(this.history.present.widgets);
    const phase = this.phase;

    if (event.direction === "up" && phase.currentIndex > 0) {
      this.phase = { ...phase, currentIndex: phase.currentIndex - 1 };
      this.announcement = `Moved to position ${phase.currentIndex} of ${visible.length}`;
    } else if (
      event.direction === "down" &&
      phase.currentIndex < visible.length - 1
    ) {
      this.phase = { ...phase, currentIndex: phase.currentIndex + 1 };
      this.announcement = `Moved to position ${phase.currentIndex + 2} of ${visible.length}`;
    }

    // Compute preview for the new position
    this.updateKeyboardPreview();
  }

  private handleKeyResize(
    event: Extract<DragEvent, { type: "KEY_RESIZE" }>,
  ): void {
    if (this.phase.type !== "keyboard-dragging") return;
    this.lastTimestamp = event.timestamp;

    const phase = this.phase;
    const constraints = this.config.getWidgetConstraints(phase.sourceId);
    const maxCols = this.config.maxColumns;

    let newSpan = phase.currentColSpan;
    if (event.direction === "shrink") {
      newSpan = Math.max(constraints.minSpan, phase.currentColSpan - 1);
    } else {
      newSpan = Math.min(
        Math.min(constraints.maxSpan, maxCols),
        phase.currentColSpan + 1,
      );
    }

    if (newSpan !== phase.currentColSpan) {
      this.phase = { ...phase, currentColSpan: newSpan };
      this.announcement = `Resized to ${newSpan} column${newSpan > 1 ? "s" : ""}`;
      this.updateKeyboardPreview();
    }
  }

  private handleKeyDrop(): void {
    if (this.phase.type !== "keyboard-dragging") return;

    const phase = this.phase;
    const visible = getVisibleSorted(this.history.present.widgets);

    // Build and apply the committed operation
    let committed: CommittedOperation;

    const cfg = this.layoutConfig();
    const involvedIds = new Set([phase.sourceId]);

    if (
      phase.currentIndex !== phase.originalIndex &&
      phase.currentColSpan !== phase.originalColSpan
    ) {
      // Both reorder and resize: use batch approach
      const resized: CommittedOperation = {
        type: "resize-toggle",
        id: phase.sourceId,
        newSpan: phase.currentColSpan,
      };
      let state = applyOperation(this.history.present, resized);
      const reorder: CommittedOperation = {
        type: "reorder",
        fromIndex: phase.originalIndex,
        toIndex: phase.currentIndex,
      };
      state = applyOperation(state, reorder);
      state = { ...state, widgets: stabilizeUninvolvedWidgets(state.widgets, this.baseLayout, involvedIds, this.containerWidth, cfg.maxColumns, cfg.gap) };
      this.history = pushState(this.history, state, MAX_UNDO_DEPTH);
      committed = reorder; // For announcement
    } else if (phase.currentIndex !== phase.originalIndex) {
      committed = {
        type: "reorder",
        fromIndex: phase.originalIndex,
        toIndex: phase.currentIndex,
      };
      let newState = applyOperation(this.history.present, committed);
      newState = { ...newState, widgets: stabilizeUninvolvedWidgets(newState.widgets, this.baseLayout, involvedIds, this.containerWidth, cfg.maxColumns, cfg.gap) };
      if (newState !== this.history.present) {
        this.history = pushState(this.history, newState, MAX_UNDO_DEPTH);
      }
    } else if (phase.currentColSpan !== phase.originalColSpan) {
      committed = {
        type: "resize-toggle",
        id: phase.sourceId,
        newSpan: phase.currentColSpan,
      };
      let newState = applyOperation(this.history.present, committed);
      newState = { ...newState, widgets: stabilizeUninvolvedWidgets(newState.widgets, this.baseLayout, involvedIds, this.containerWidth, cfg.maxColumns, cfg.gap) };
      if (newState !== this.history.present) {
        this.history = pushState(this.history, newState, MAX_UNDO_DEPTH);
      }
    } else {
      committed = { type: "cancelled" };
    }

    this.phase = { type: "idle" };
    this.clearDragState();
    this.recomputeLayouts();

    this.announcement = `Dropped at position ${phase.currentIndex + 1} of ${visible.length}`;
  }

  private handleKeyCancel(): void {
    if (this.phase.type !== "keyboard-dragging") return;

    this.phase = { type: "idle" };
    this.clearDragState();
    this.recomputeLayouts();
    this.announcement = "Drag cancelled";
  }

  private handleCancel(): void {
    if (this.phase.type === "idle") return;

    if (this.phase.type === "keyboard-dragging") {
      this.handleKeyCancel();
      return;
    }

    this.phase = { type: "idle" };
    this.clearDragState();
    this.announcement = "Drag cancelled";
  }

  private handleTick(event: Extract<DragEvent, { type: "TICK" }>): void {
    this.lastTimestamp = event.timestamp;

    if (this.phase.type === "pending") {
      this.handlePendingTick(event);
    } else if (this.phase.type === "dragging") {
      this.updateZoneAndIntent(event.timestamp);
    } else if (this.phase.type === "dropping") {
      if (
        event.timestamp - this.phase.startTime >=
        this.config.dropAnimationDuration
      ) {
        this.phase = { type: "idle" };
        this.clearDragState();
        this.recomputeLayouts();
      }
    }
  }

  private handlePendingTick(
    event: Extract<DragEvent, { type: "TICK" }>,
  ): void {
    if (this.phase.type !== "pending") return;
    const phase = this.phase;

    if (phase.pointerType === "touch") {
      if (
        event.timestamp - phase.startTime >= this.config.touchActivationDelay
      ) {
        this.activateDrag(phase.sourceId, phase.startPos, phase.startPos);
      }
    }
  }

  private handleResizeToggle(
    event: Extract<DragEvent, { type: "RESIZE_TOGGLE" }>,
  ): void {
    if (this.phase.type !== "idle") return;

    const state = this.history.present;
    const widget = state.widgets.find((w) => w.id === event.id);
    if (!widget) return;

    const constraints = this.config.getWidgetConstraints(event.id);
    const maxCols = this.config.maxColumns;
    const maxSpan = Math.min(constraints.maxSpan, maxCols);

    // Cycle: current → maxSpan → minSpan → current... (or just toggle if only 2 options)
    let newSpan: number;
    if (widget.colSpan < maxSpan) {
      newSpan = maxSpan;
    } else {
      newSpan = Math.max(constraints.minSpan, 1);
    }

    if (newSpan === widget.colSpan) return;

    const committed: CommittedOperation = {
      type: "resize-toggle",
      id: event.id,
      newSpan,
    };

    let newState = applyOperation(state, committed);
    if (newState !== state) {
      const cfg = this.layoutConfig();
      newState = { ...newState, widgets: stabilizeUninvolvedWidgets(newState.widgets, this.baseLayout, new Set([event.id]), this.containerWidth, cfg.maxColumns, cfg.gap) };
      this.history = pushState(this.history, newState, MAX_UNDO_DEPTH);
      this.recomputeLayouts();
    }
  }

  // ─── Internal Helpers ────────────────────────────────────────

  private activateDrag(
    sourceId: string,
    pointerPos: Point,
    startPos: Point,
  ): void {
    // Compute grab offset from the widget's position in the base layout
    const widgetLayout = this.baseLayout.positions.get(sourceId);
    const grabOffset: Point = widgetLayout
      ? {
          x: startPos.x - widgetLayout.x,
          y: startPos.y - widgetLayout.y,
        }
      : { x: 0, y: 0 };

    this.phase = {
      type: "dragging",
      sourceId,
      pointerPos,
      grabOffset,
    };

    // Compute drag layout (with phantom or exclusion)
    this.dragLayout = solveDragLayout(
      this.history.present.widgets,
      this.heights,
      this.containerWidth,
      this.layoutConfig(),
      sourceId,
    );

    this.announcement = "Dragging started";
  }

  private updateZoneAndIntent(timestamp: number): void {
    if (this.phase.type !== "dragging") return;

    const state = this.history.present;
    const visible = getVisibleSorted(state.widgets);
    const layout = this.dragLayout ?? this.baseLayout;

    const computedZone = resolveZone(
      this.phase.pointerPos,
      layout,
      state.widgets,
      state.gap,
      state.maxColumns,
      this.containerWidth,
      this.phase.sourceId,
    );

    // 2-frame debounce: only commit a zone change after it's stable for
    // 2 consecutive frames. This prevents flicker when the pointer
    // briefly crosses zone boundaries (matches the old system's pattern).
    if (!zonesEqual(computedZone, this.currentZone)) {
      if (zonesEqual(computedZone, this.pendingZone)) {
        this.pendingZoneFrames++;
        if (this.pendingZoneFrames >= 2) {
          // Stable for 2 frames — commit
          this.currentZone = computedZone;
          this.zoneEnteredAt = timestamp;
          this.pendingZone = null;
          this.pendingZoneFrames = 0;
        }
      } else {
        // New pending zone
        this.pendingZone = computedZone;
        this.pendingZoneFrames = 1;
        // Immediate commit for first zone (null → zone) or clearing (zone → outside)
        if (
          this.currentZone === null ||
          computedZone.type === "outside"
        ) {
          this.currentZone = computedZone;
          this.zoneEnteredAt = timestamp;
          this.pendingZone = null;
          this.pendingZoneFrames = 0;
        }
      }
    } else {
      // Zone is stable — clear any pending
      this.pendingZone = null;
      this.pendingZoneFrames = 0;
    }

    // Only resolve intent if we have a committed zone
    if (!this.currentZone) return;

    const dwellMs = timestamp - this.zoneEnteredAt;
    const sourceId = (this.phase as Extract<DragPhase, { type: "dragging" }>).sourceId;
    const source = state.widgets.find((w) => w.id === sourceId);
    if (!source) return;

    const newIntent = resolveIntent(this.currentZone, dwellMs, source, visible, {
      swapDwellMs: this.config.swapDwellMs,
      resizeDwellMs: this.config.resizeDwellMs,
      maxColumns: state.maxColumns,
      isLocked: this.config.isLocked,
      canDrop: this.config.canDrop,
      getWidgetConstraints: this.config.getWidgetConstraints,
    });

    // Only recompute preview layout if intent changed
    if (!this.intentsEqual(newIntent, this.currentIntent)) {
      this.currentIntent = newIntent;
      this.previewLayout =
        newIntent.type !== "none"
          ? solvePreviewLayout(
              state.widgets,
              this.heights,
              this.containerWidth,
              this.layoutConfig(),
              newIntent,
              sourceId,
              this.baseLayout,
            )
          : null;
    }
  }

  private updateKeyboardPreview(): void {
    if (this.phase.type !== "keyboard-dragging") return;

    const phase = this.phase;
    const state = this.history.present;

    // Build a tentative widget state with the resize and reorder applied
    let tentativeWidgets = state.widgets.map((w) =>
      w.id === phase.sourceId ? { ...w, colSpan: phase.currentColSpan } : w,
    );

    const visible = getVisibleSorted(tentativeWidgets);
    const sourceIdx = visible.findIndex((w) => w.id === phase.sourceId);
    if (sourceIdx === -1) return;

    if (sourceIdx !== phase.currentIndex) {
      const reordered = [...visible];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(phase.currentIndex, 0, moved);
      tentativeWidgets = reordered.map((w, i) => ({
        ...w,
        order: i,
        columnStart: undefined,
      }));
      // Add back hidden widgets
      const hidden = state.widgets.filter((w) => !w.visible);
      tentativeWidgets = [...tentativeWidgets, ...hidden];
    }

    this.previewLayout = solveBaseLayout(
      tentativeWidgets,
      this.heights,
      this.containerWidth,
      this.layoutConfig(),
    );
  }

  private commitIntent(
    sourceId: string,
    intent: OperationIntent,
  ): CommittedOperation {
    const visible = getVisibleSorted(this.history.present.widgets);
    const sourceIdx = visible.findIndex((w) => w.id === sourceId);

    switch (intent.type) {
      case "none":
        return { type: "cancelled" };

      case "reorder":
        return {
          type: "reorder",
          fromIndex: sourceIdx,
          toIndex: intent.targetIndex,
        };

      case "swap":
        return {
          type: "swap",
          sourceId,
          targetId: intent.targetId,
        };

      case "auto-resize":
        return {
          type: "auto-resize",
          sourceId,
          targetId: intent.targetId,
          sourceSpan: intent.sourceSpan,
          targetSpan: intent.targetSpan,
          targetIndex: intent.targetIndex,
        };

      case "column-pin":
        return {
          type: "column-pin",
          sourceId,
          column: intent.column,
          targetIndex: sourceIdx,
        };
    }
  }

  private getInvolvedIds(sourceId: string, op: CommittedOperation): ReadonlySet<string> {
    switch (op.type) {
      case "reorder":
        return new Set([sourceId]);
      case "swap":
        return new Set([op.sourceId, op.targetId]);
      case "auto-resize":
        return new Set([op.sourceId, op.targetId]);
      case "column-pin":
        return new Set([op.sourceId]);
      case "resize-toggle":
        return new Set([op.id]);
      case "cancelled":
        return new Set();
    }
  }

  private clearDragState(): void {
    this.currentZone = null;
    this.currentIntent = null;
    this.dragLayout = null;
    this.previewLayout = null;
    this.zoneEnteredAt = 0;
    this.pendingZone = null;
    this.pendingZoneFrames = 0;
  }

  private recomputeBaseLayout(): void {
    const widgets = this.history.present.widgets;
    const cfg = this.layoutConfig();
    const inputs = this.lastLayoutInputs;

    // Skip recomputation if all inputs are referentially identical
    if (
      inputs &&
      inputs.widgets === widgets &&
      inputs.heights === this.heights &&
      inputs.containerWidth === this.containerWidth &&
      inputs.maxColumns === cfg.maxColumns &&
      inputs.gap === cfg.gap &&
      inputs.autoFillMode === cfg.autoFillMode
    ) {
      return;
    }

    this.lastLayoutInputs = {
      widgets,
      heights: this.heights,
      containerWidth: this.containerWidth,
      maxColumns: cfg.maxColumns,
      gap: cfg.gap,
      autoFillMode: cfg.autoFillMode,
    };

    this.baseLayout = solveBaseLayout(
      widgets,
      this.heights,
      this.containerWidth,
      cfg,
    );
  }

  private recomputeLayouts(): void {
    this.recomputeBaseLayout();

    if (
      this.phase.type === "dragging"
    ) {
      this.dragLayout = solveDragLayout(
        this.history.present.widgets,
        this.heights,
        this.containerWidth,
        this.layoutConfig(),
        this.phase.sourceId,
      );
    } else {
      this.dragLayout = null;
    }
  }

  private layoutConfig(): LayoutSolverConfig {
    // Use maxColumns/gap from the DashboardState (set by SET_MAX_COLUMNS
    // action), not from the engine config. The config holds defaults for
    // construction; runtime values live in state.
    const state = this.history.present;
    return {
      autoFillMode: this.config.autoFillMode,
      maxColumns: state.maxColumns,
      gap: state.gap,
    };
  }

  private intentsEqual(
    a: OperationIntent | null,
    b: OperationIntent | null,
  ): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.type !== b.type) return false;

    switch (a.type) {
      case "none":
        return true;
      case "reorder":
        return a.targetIndex === (b as typeof a).targetIndex;
      case "swap":
        return a.targetId === (b as typeof a).targetId;
      case "auto-resize":
        return (
          a.targetId === (b as typeof a).targetId &&
          a.sourceSpan === (b as typeof a).sourceSpan &&
          a.targetSpan === (b as typeof a).targetSpan &&
          a.targetIndex === (b as typeof a).targetIndex
        );
      case "column-pin":
        return a.column === (b as typeof a).column;
    }
  }

  private snapshotsEqual(a: DragEngineSnapshot, b: DragEngineSnapshot): boolean {
    // dragPosition is excluded — it changes every POINTER_MOVE (60fps)
    // and is read directly by the RAF loop, not through React re-renders.
    //
    // phase is compared by type + sourceId only — pointerPos/grabOffset
    // change every move and are only consumed via dragPosition.
    //
    // dwellProgress is excluded — it changes every TICK frame while
    // hovering over a widget zone (continuous 0→1). Including it would
    // cause 60fps React re-renders. If UI needs it, read it via a
    // separate subscription.
    return (
      this.phasesEqual(a.phase, b.phase) &&
      a.layout === b.layout &&
      a.previewLayout === b.previewLayout &&
      a.intent === b.intent &&
      a.zone === b.zone &&
      a.announcement === b.announcement &&
      a.widgets === b.widgets &&
      a.canUndo === b.canUndo &&
      a.canRedo === b.canRedo
    );
  }

  private phasesEqual(a: DragPhase, b: DragPhase): boolean {
    if (a.type !== b.type) return false;
    switch (a.type) {
      case "idle":
        return true;
      case "pending":
        return a.sourceId === (b as typeof a).sourceId;
      case "dragging":
        // pointerPos/grabOffset excluded — high-frequency, read via dragPosition
        return a.sourceId === (b as typeof a).sourceId;
      case "keyboard-dragging":
        return (
          a.sourceId === (b as typeof a).sourceId &&
          a.currentIndex === (b as typeof a).currentIndex &&
          a.currentColSpan === (b as typeof a).currentColSpan
        );
      case "dropping":
        return a.sourceId === (b as typeof a).sourceId;
    }
  }

  private buildDropAnnouncement(operation: CommittedOperation): string {
    switch (operation.type) {
      case "reorder":
        return `Moved to position ${operation.toIndex + 1}`;
      case "swap":
        return "Swapped with widget";
      case "auto-resize":
        return "Resized and placed adjacent";
      case "column-pin":
        return `Pinned to column ${operation.column + 1}`;
      case "resize-toggle":
        return `Resized to ${operation.newSpan} column${operation.newSpan > 1 ? "s" : ""}`;
      case "cancelled":
        return "Drop cancelled";
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
