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
import { distance, getVisibleSorted, zonesEqual, getPinnedIds } from "./utils.ts";
import { resolveZone } from "./zone-resolver.ts";
import { resolveIntent, computeDwellProgress } from "./intent-resolver.ts";
import { applyOperation } from "./operation-applier.ts";
import {
  solveBaseLayout,
  solveDragLayout,
  solvePreviewLayout,
  stabilizeUninvolvedWidgets,
  pinToGreedyColumns,
  findColumnPinInsertionIndex,
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
  "BATCH_UPDATE",
  "SET_MAX_COLUMNS",
  "SHOW_WIDGET",
  "HIDE_WIDGET",
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
    isPositionLocked: () => false,
    isResizeLocked: () => false,
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

  private currentZone: DropZone | null = null;
  private zoneEnteredAt = 0;
  private currentIntent: OperationIntent | null = null;

  private pendingZone: DropZone | null = null;
  private pendingZoneFrames = 0;
  private lastZonePointerPos: Point | null = null;
  private sideCollapsed = false;
  private intentGraceStart: number | null = null;

  private baseLayout: ComputedLayout = { positions: new Map(), totalHeight: 0 };
  private dragLayout: ComputedLayout | null = null;
  private previewLayout: ComputedLayout | null = null;

  private lastLayoutInputs: {
    widgets: readonly import("../types.ts").WidgetState[];
    heights: ReadonlyMap<string, number>;
    containerWidth: number;
    maxColumns: number;
    gap: number;
    autoFillMode: string;
  } | null = null;

  private announcement: string | null = null;

  private listeners = new Set<() => void>();
  private cachedSnapshot: DragEngineSnapshot | null = null;

  private lastTimestamp = 0;

  constructor(
    initialState: DashboardState,
    config?: Partial<DragEngineConfig>,
  ) {
    this.config = { ...defaultConfig(), ...config };
    this.history = createUndoHistory(initialState);
    this.containerWidth = initialState.containerWidth;
    this.recomputeBaseLayout();
  }

  send = (event: DragEvent): void => {
    this.announcement = null;

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

    const newSnapshot = this.getSnapshot();
    if (prevSnapshot && this.snapshotsEqual(prevSnapshot, newSnapshot)) {
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

    if (action.type === "RESIZE_WIDGET" && this.config.isResizeLocked(action.id)) {
      return;
    }

    let newState = dashboardReducer(this.history.present, action);
    if (newState === this.history.present) return;

    if (action.type === "RESIZE_WIDGET") {
      const cfg = this.layoutConfig();
      newState = { ...newState, widgets: pinToGreedyColumns(newState.widgets, cfg.maxColumns) };
    }

    if (UNDOABLE_ACTIONS.has(action.type)) {
      this.history = pushState(this.history, newState, MAX_UNDO_DEPTH);
    } else {
      this.history = { ...this.history, present: newState };
    }

    this.recomputeLayouts();
    this.notify();
  }

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
  }

  destroy(): void {
    this.listeners.clear();
  }

  private handlePointerDown(
    event: Extract<DragEvent, { type: "POINTER_DOWN" }>,
  ): void {
    if (this.phase.type !== "idle") return;
    if (this.config.isPositionLocked(event.id)) return;

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
      this.phase = {
        ...this.phase,
        pointerPos: event.position,
      };
    }
  }

  private handlePendingMove(
    event: Extract<DragEvent, { type: "POINTER_MOVE" }>,
  ): void {
    if (this.phase.type !== "pending") return;
    const phase = this.phase;

    const dist = distance(event.position, phase.startPos);

    if (phase.pointerType === "touch") {
      const cumulative = phase.cumulativeDistance + dist;
      if (cumulative > this.config.touchMoveTolerance) {
        this.phase = { type: "idle" };
        this.clearDragState();
        return;
      }
      this.phase = { ...phase, cumulativeDistance: cumulative };
    } else {
      if (dist >= this.config.activationThreshold) {
        this.activateDrag(phase.sourceId, event.position, phase.startPos);
      }
    }
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

    const committed = this.commitIntent(sourceId, intent);

    if (committed.type === "reorder" && committed.fromIndex === committed.toIndex) {
      this.phase = { type: "idle" };
      this.clearDragState();
      this.announcement = "Drop cancelled";
      return;
    }

    const newState = this.applyCommittedOperation(sourceId, committed);

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
      this.cancelDrag(false);
    }
  }

  private handleKeyPickup(
    event: Extract<DragEvent, { type: "KEY_PICKUP" }>,
  ): void {
    if (this.phase.type !== "idle") return;
    if (this.config.isPositionLocked(event.id)) return;

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

    const hasReorder = phase.currentIndex !== phase.originalIndex;
    const hasResize = phase.currentColSpan !== phase.originalColSpan;

    if (hasReorder || hasResize) {
      const cfg = this.layoutConfig();
      const involvedIds = new Set([phase.sourceId]);
      let state = this.history.present;

      if (hasResize) {
        state = applyOperation(state, {
          type: "resize-toggle",
          id: phase.sourceId,
          newSpan: phase.currentColSpan,
        });
      }

      if (hasReorder) {
        state = applyOperation(state, {
          type: "reorder",
          fromIndex: phase.originalIndex,
          toIndex: phase.currentIndex,
        });
      }

      state = {
        ...state,
        widgets: stabilizeUninvolvedWidgets(
          state.widgets, this.baseLayout, involvedIds,
          this.containerWidth, cfg.maxColumns, cfg.gap
        ),
      };

      if (state !== this.history.present) {
        this.history = pushState(this.history, state, MAX_UNDO_DEPTH);
      }
    }

    this.phase = { type: "idle" };
    this.clearDragState();
    this.recomputeLayouts();

    this.announcement = `Dropped at position ${phase.currentIndex + 1} of ${visible.length}`;
  }

  private handleKeyCancel(): void {
    if (this.phase.type !== "keyboard-dragging") return;
    this.cancelDrag(true);
  }

  private handleCancel(): void {
    if (this.phase.type === "idle") return;

    if (this.phase.type === "keyboard-dragging") {
      this.handleKeyCancel();
      return;
    }

    this.cancelDrag(false);
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
    if (this.config.isResizeLocked(event.id)) return;

    const state = this.history.present;
    const widget = state.widgets.find((w) => w.id === event.id);
    if (!widget) return;

    const constraints = this.config.getWidgetConstraints(event.id);
    const maxCols = this.config.maxColumns;
    const maxSpan = Math.min(constraints.maxSpan, maxCols);

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

  // ---------------------------------------------------------------------------
  // Post-commit operation logic
  // ---------------------------------------------------------------------------

  private applyCommittedOperation(
    sourceId: string,
    committed: CommittedOperation,
  ): DashboardState {
    let newState = applyOperation(this.history.present, committed);
    const cfg = this.layoutConfig();

    if (committed.type === "swap") {
      newState = this.applySwapPostCommit(newState, committed);
    } else if (committed.type === "auto-resize") {
      newState = this.applyAutoResizePostCommit(newState, committed);
    } else if (committed.type === "column-pin") {
      const maxSpanAtCol = Math.max(1, cfg.maxColumns - committed.column);
      newState = {
        ...newState,
        widgets: newState.widgets.map(w =>
          w.id === committed.sourceId && w.colSpan > maxSpanAtCol
            ? { ...w, colSpan: maxSpanAtCol }
            : w
        ),
      };
    } else if (committed.type === "reorder" && this.baseLayout) {
      const involvedIds = new Set([sourceId]);
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
    } else {
      newState = {
        ...newState,
        widgets: pinToGreedyColumns(newState.widgets, cfg.maxColumns),
      };
    }

    return newState;
  }

  private applySwapPostCommit(
    newState: DashboardState,
    committed: Extract<CommittedOperation, { type: "swap" }>,
  ): DashboardState {
    const cfg = this.layoutConfig();
    const preSwapWidgets = this.history.present.widgets;
    const preSrc = preSwapWidgets.find(w => w.id === committed.sourceId);
    const preTgt = preSwapWidgets.find(w => w.id === committed.targetId);
    const srcCol = preSrc?.columnStart;
    const tgtCol = preTgt?.columnStart;

    if (srcCol != null || tgtCol != null) {
      const samePinCol = srcCol != null && tgtCol != null && srcCol === tgtCol;
      newState = {
        ...newState,
        widgets: newState.widgets.map(w => {
          if (samePinCol && (w.id === committed.sourceId || w.id === committed.targetId)) {
            return { ...w, columnStart: undefined };
          }
          if (w.id === committed.sourceId && tgtCol != null) {
            return { ...w, columnStart: tgtCol };
          }
          if (w.id === committed.targetId && srcCol != null) {
            return { ...w, columnStart: srcCol };
          }
          return w;
        }),
      };
    }

    const srcPos = this.baseLayout.positions.get(committed.sourceId);
    const tgtPos = this.baseLayout.positions.get(committed.targetId);
    if (srcPos && tgtPos && Math.abs(srcPos.y - tgtPos.y) < 1) {
      const involvedIds = new Set([committed.sourceId, committed.targetId]);
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
    }

    const pinned = getPinnedIds(newState.widgets);

    newState = {
      ...newState,
      widgets: pinToGreedyColumns(newState.widgets, cfg.maxColumns, pinned),
    };

    return newState;
  }

  private applyAutoResizePostCommit(
    newState: DashboardState,
    committed: Extract<CommittedOperation, { type: "auto-resize" }>,
  ): DashboardState {
    const cfg = this.layoutConfig();
    const preWidgets = this.history.present.widgets;
    const preSrc = preWidgets.find(w => w.id === committed.sourceId);
    const preTgt = preWidgets.find(w => w.id === committed.targetId);
    const srcCol = preSrc?.columnStart;
    const tgtCol = preTgt?.columnStart;

    let needsSwap = false;
    if (srcCol != null) {
      const withoutSource = preWidgets.filter(w => w.visible && w.id !== committed.sourceId)
        .sort((a, b) => a.order - b.order)
        .map(w => w.id === committed.targetId ? { ...w, colSpan: committed.targetSpan } : w);
      const checkLayout = solveBaseLayout(
        withoutSource.map((w, i) => ({ ...w, order: i })),
        this.heights, this.containerWidth, cfg,
      );
      const tgtPos = checkLayout.positions.get(committed.targetId);
      if (tgtPos) {
        const colW = (this.containerWidth - cfg.gap * (cfg.maxColumns - 1)) / cfg.maxColumns;
        let rowOcc = 0;
        for (const [, p] of checkLayout.positions) {
          if (Math.abs(p.y - tgtPos.y) < 1) {
            rowOcc += Math.max(1, Math.round((p.width + cfg.gap) / (colW + cfg.gap)));
          }
        }
        if (rowOcc + committed.sourceSpan > cfg.maxColumns) {
          needsSwap = true;
        }
      }

      if (!needsSwap && tgtCol != null) {
        const postVisible = getVisibleSorted(newState.widgets);
        const srcPostIdx = postVisible.findIndex(w => w.id === committed.sourceId);
        const tgtPostIdx = postVisible.findIndex(w => w.id === committed.targetId);
        const srcAfterTgt = srcPostIdx > tgtPostIdx;
        if (srcAfterTgt && srcCol < tgtCol) needsSwap = true;
        if (!srcAfterTgt && srcCol > tgtCol) needsSwap = true;
      }
    }

    if (srcCol != null || tgtCol != null) {
      if (needsSwap) {
        const preVisible = getVisibleSorted(preWidgets);
        const srcOrigIdx = preVisible.findIndex(w => w.id === committed.sourceId);
        const postVisible = getVisibleSorted(newState.widgets);
        const tgtCurIdx = postVisible.findIndex(w => w.id === committed.targetId);

        if (srcCol != null && srcOrigIdx >= 0 && tgtCurIdx >= 0 && tgtCurIdx !== srcOrigIdx) {
          newState = applyOperation(newState, {
            type: "reorder",
            fromIndex: tgtCurIdx,
            toIndex: srcOrigIdx,
          });
        }

        newState = {
          ...newState,
          widgets: newState.widgets.map(w => {
            if (w.id === committed.sourceId && tgtCol != null) {
              return { ...w, columnStart: tgtCol };
            }
            if (w.id === committed.targetId && srcCol != null) {
              return { ...w, columnStart: srcCol };
            }
            return w;
          }),
        };
      }

      const pinned = getPinnedIds(newState.widgets);

      newState = {
        ...newState,
        widgets: pinToGreedyColumns(newState.widgets, cfg.maxColumns, pinned),
      };
    } else {
      const srcPos = this.baseLayout.positions.get(committed.sourceId);
      const tgtPos = this.baseLayout.positions.get(committed.targetId);
      if (srcPos && tgtPos && Math.abs(srcPos.y - tgtPos.y) < 1) {
        const involvedIds = new Set([committed.sourceId, committed.targetId]);
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
        const pinned = getPinnedIds(newState.widgets);
        newState = {
          ...newState,
          widgets: pinToGreedyColumns(newState.widgets, cfg.maxColumns, pinned),
        };
      } else {
        newState = {
          ...newState,
          widgets: pinToGreedyColumns(newState.widgets, cfg.maxColumns),
        };
      }
    }

    return newState;
  }

  // ---------------------------------------------------------------------------
  // Drag lifecycle helpers
  // ---------------------------------------------------------------------------

  private cancelDrag(recompute: boolean): void {
    this.phase = { type: "idle" };
    this.clearDragState();
    if (recompute) this.recomputeLayouts();
    this.announcement = "Drag cancelled";
  }

  private activateDrag(
    sourceId: string,
    pointerPos: Point,
    startPos: Point,
  ): void {
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

    const currentWidgetSide =
      this.currentZone?.type === "widget" ? this.currentZone.side : undefined;

    const computedZone = resolveZone(
      this.phase.pointerPos,
      layout,
      state.widgets,
      state.gap,
      state.maxColumns,
      this.containerWidth,
      this.phase.sourceId,
      currentWidgetSide,
    );

    if (!zonesEqual(computedZone, this.currentZone)) {
      if (zonesEqual(computedZone, this.pendingZone)) {
        this.pendingZoneFrames++;
        if (this.pendingZoneFrames >= 2) {
          this.currentZone = computedZone;
          this.zoneEnteredAt = timestamp;
          this.lastZonePointerPos = null;
          this.pendingZone = null;
          this.pendingZoneFrames = 0;
          this.sideCollapsed = false;
          this.intentGraceStart = null;
        }
      } else {
        this.pendingZone = computedZone;
        this.pendingZoneFrames = 1;
        if (
          this.currentZone === null ||
          computedZone.type === "outside"
        ) {
          this.currentZone = computedZone;
          this.zoneEnteredAt = timestamp;
          this.lastZonePointerPos = null;
          this.pendingZone = null;
          this.pendingZoneFrames = 0;
          this.sideCollapsed = false;
          this.intentGraceStart = null;
        }
      }
    } else {
      this.pendingZone = null;
      this.pendingZoneFrames = 0;
      if (
        computedZone.type === "widget" &&
        this.currentZone?.type === "widget" &&
        computedZone.side !== this.currentZone.side
      ) {
        this.currentZone = computedZone;
      }
    }

    if (!this.currentZone) return;

    const pointerPos = this.phase.type === "dragging" ? this.phase.pointerPos : null;
    if (pointerPos && this.lastZonePointerPos) {
      const drift = distance(pointerPos, this.lastZonePointerPos);
      if (drift > 20) {
        this.zoneEnteredAt = timestamp;
        this.lastZonePointerPos = { x: pointerPos.x, y: pointerPos.y };
      }
    } else if (pointerPos) {
      this.lastZonePointerPos = { x: pointerPos.x, y: pointerPos.y };
    }

    const dwellMs = timestamp - this.zoneEnteredAt;
    const sourceId = (this.phase as Extract<DragPhase, { type: "dragging" }>).sourceId;
    const source = state.widgets.find((w) => w.id === sourceId);
    if (!source) return;

    let effectiveResizeDwellMs = this.config.resizeDwellMs;
    if (
      this.currentZone.type === "widget" &&
      this.phase.type === "dragging" &&
      layout
    ) {
      const targetId = this.currentZone.targetId;
      const targetPos = layout.positions.get(targetId);
      if (targetPos) {
        const centerX = targetPos.x + targetPos.width / 2;
        const halfWidth = targetPos.width / 2;
        const sideStrength = halfWidth > 0
          ? Math.abs(this.phase.pointerPos.x - centerX) / halfWidth
          : 0;
        const wasSideCollapsed = this.sideCollapsed;
        if (this.sideCollapsed) {
          if (sideStrength < 0.1) {
            this.sideCollapsed = false;
          }
        } else {
          if (sideStrength > 0.2) {
            this.sideCollapsed = true;
          }
        }
        if (this.sideCollapsed) {
          const target = state.widgets.find((w) => w.id === targetId);
          const spansExceedMax = target
            ? source.colSpan + target.colSpan > state.maxColumns
            : false;
          if (spansExceedMax) {
            if (!wasSideCollapsed) {
              this.zoneEnteredAt = timestamp;
            }
            effectiveResizeDwellMs = Math.min(this.config.resizeDwellMs, 400);
          } else {
            effectiveResizeDwellMs = this.config.swapDwellMs;
          }
        }
      }
    }

    let newIntent = resolveIntent(this.currentZone, dwellMs, source, visible, {
      swapDwellMs: this.config.swapDwellMs,
      resizeDwellMs: effectiveResizeDwellMs,
      maxColumns: state.maxColumns,
      isPositionLocked: this.config.isPositionLocked,
      canDrop: this.config.canDrop,
      getWidgetConstraints: this.config.getWidgetConstraints,
    });

    if (
      newIntent.type === "none" &&
      this.currentIntent != null &&
      this.currentIntent.type !== "none"
    ) {
      if (this.intentGraceStart === null) {
        this.intentGraceStart = timestamp;
      }
      if (timestamp - this.intentGraceStart < 100) {
        return;
      }
      this.intentGraceStart = null;
    } else {
      this.intentGraceStart = null;
    }

    if (newIntent.type === "column-pin" && this.phase.type === "dragging") {
      newIntent = { ...newIntent, pointerY: this.phase.pointerPos.y };
    }

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

      case "column-pin": {
        const remaining = visible.filter(w => w.id !== sourceId);
        const cfg = this.layoutConfig();
        const insertIdx = findColumnPinInsertionIndex(
          remaining, intent.column, intent.pointerY,
          cfg.maxColumns, cfg.gap, this.heights,
        );
        return {
          type: "column-pin",
          sourceId,
          column: intent.column,
          targetIndex: Math.min(insertIdx, remaining.length),
        };
      }
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
    this.lastZonePointerPos = null;
    this.sideCollapsed = false;
    this.intentGraceStart = null;
  }

  private recomputeBaseLayout(): void {
    const widgets = this.history.present.widgets;
    const cfg = this.layoutConfig();
    const inputs = this.lastLayoutInputs;

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

    if (this.phase.type === "dragging") {
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
