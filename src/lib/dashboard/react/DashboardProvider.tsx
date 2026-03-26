import { useCallback, useRef, useMemo, useEffect, useSyncExternalStore } from "react";
import type {
  DashboardProviderProps,
  DashboardState,
  DashboardAction,
  DragHandleA11yProps,
  DragState,
  WidgetDefinition,
} from "../types.ts";
import { DEFAULT_MAX_COLUMNS, DEFAULT_GAP } from "../constants.ts";
import { dashboardReducer } from "../state/dashboard-reducer.ts";
import { DashboardContext, useActions } from "../state/use-dashboard.ts";
import { useDragEngine } from "./use-drag-engine.ts";
import { usePointerAdapter } from "./use-pointer-adapter.ts";
import { useKeyboardAdapter } from "./use-keyboard-adapter.ts";
import { useMeasurementBridge } from "./use-measurement-bridge.ts";
import { useAutoScroll } from "../drag/use-auto-scroll.ts";
import { useDragAnnouncements } from "../drag/use-drag-announcements.ts";

export function DashboardProviderV2(props: DashboardProviderProps) {
  const {
    definitions,
    maxColumns = DEFAULT_MAX_COLUMNS,
    gap = DEFAULT_GAP,
    maxWidgets,
    keyboardShortcuts = true,
    canDrop,
    children,
  } = props;

  const isControlled = "state" in props && props.state !== undefined;
  const initialWidgets =
    !isControlled && "initialWidgets" in props && props.initialWidgets
      ? props.initialWidgets
      : [];
  const controlledState = isControlled
    ? (props as { state: DashboardState }).state
    : undefined;
  const onStateChange = isControlled
    ? (props as { onStateChange: (s: DashboardState) => void }).onStateChange
    : undefined;

  const initialState: DashboardState = controlledState ?? {
    widgets: initialWidgets,
    maxColumns,
    gap,
    containerWidth: 0,
  };

  // Stable config ref for canDrop (avoids recreating the wrapper every render)
  const canDropRef = useRef(canDrop);
  useEffect(() => { canDropRef.current = canDrop; });

  // Create the headless engine
  const engineConfig = useMemo(() => ({
    maxColumns,
    gap,
  }), [maxColumns, gap]);

  const engine = useDragEngine(initialState, definitions, engineConfig);

  // Bridge measurements
  const { measureRef, containerRef } = useMeasurementBridge(engine);

  // Bridge pointer events
  const { startDrag } = usePointerAdapter(engine, containerRef);

  // Bridge keyboard events
  const { handleKeyDown } = useKeyboardAdapter(engine);

  // Subscribe to engine snapshot
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
  );

  // Forward controlled state changes
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; });

  // Announcements
  const { announce, LiveRegion } = useDragAnnouncements();
  useEffect(() => {
    if (snapshot.announcement) {
      announce(snapshot.announcement);
    }
  }, [snapshot.announcement, announce]);

  // Auto-scroll
  const getDragPositionForScroll = useCallback(() => snapshot.dragPosition, [snapshot.dragPosition]);
  useAutoScroll(
    snapshot.phase.type === "dragging",
    getDragPositionForScroll,
  );

  // Build actions that delegate to the engine
  const dispatch = useCallback(
    (action: DashboardAction) => {
      if (onStateChangeRef.current) {
        // Controlled mode: compute next state and hand to parent
        const nextState = dashboardReducer(engine.getState(), action);
        onStateChangeRef.current(nextState);
      } else {
        engine.dispatch(action);
      }
    },
    [engine],
  );

  const getState = useCallback(() => engine.getState(), [engine]);
  const actions = useActions({ dispatch, definitions, getState, maxWidgets });

  // Constraint helpers
  const isWidgetLocked = useCallback(
    (id: string) => resolveConstraint(id, "locked", engine.getState(), definitions),
    [engine, definitions],
  );
  const isWidgetRemovable = useCallback(
    (id: string) => resolveDefConstraint(id, "removable", engine.getState(), definitions),
    [engine, definitions],
  );
  const isWidgetHideable = useCallback(
    (id: string) => resolveDefConstraint(id, "hideable", engine.getState(), definitions),
    [engine, definitions],
  );
  const isWidgetResizable = useCallback(
    (id: string) => resolveDefConstraint(id, "resizable", engine.getState(), definitions),
    [engine, definitions],
  );
  const canAddWidget = useCallback(
    () => maxWidgets == null || engine.getState().widgets.length < maxWidgets,
    [engine, maxWidgets],
  );

  // Map engine snapshot to legacy DragState for compatibility
  const dragState: DragState = useMemo(() => {
    const phase = snapshot.phase;
    if (phase.type === "dragging") {
      return {
        activeId: phase.sourceId,
        dropTargetIndex: snapshot.intent?.type === "reorder" ? snapshot.intent.targetIndex : null,
        previewColSpan: snapshot.intent?.type === "auto-resize" ? snapshot.intent.sourceSpan : null,
        previewLayout: snapshot.previewLayout,
        isLongPressing: false,
        longPressTargetId: null,
      };
    }
    if (phase.type === "keyboard-dragging") {
      return {
        activeId: phase.sourceId,
        dropTargetIndex: phase.currentIndex,
        previewColSpan: null,
        previewLayout: snapshot.previewLayout,
        isLongPressing: false,
        longPressTargetId: null,
      };
    }
    if (phase.type === "pending") {
      return {
        activeId: null,
        dropTargetIndex: null,
        previewColSpan: null,
        previewLayout: null,
        isLongPressing: phase.pointerType === "touch",
        longPressTargetId: phase.pointerType === "touch" ? phase.sourceId : null,
      };
    }
    return {
      activeId: null,
      dropTargetIndex: null,
      previewColSpan: null,
      previewLayout: null,
      isLongPressing: false,
      longPressTargetId: null,
    };
  }, [snapshot]);

  // Read drag position directly from the engine phase, bypassing the
  // snapshot cache. Called 60fps by the WidgetSlot RAF loop — MUST
  // always return the latest pointer position without any caching.
  const getDragPosition = useCallback(
    () => engine.getDragPosition(),
    [engine],
  );

  // A11y props
  const getA11yProps = useCallback(
    (widgetId: string): DragHandleA11yProps => {
      const widget = engine.getState().widgets.find((w) => w.id === widgetId);
      const def = widget ? definitions.find((d) => d.type === widget.type) : undefined;
      const label = def?.label ?? widget?.type ?? "Unknown";

      const isKbDragging =
        snapshot.phase.type === "keyboard-dragging" &&
        snapshot.phase.sourceId === widgetId;

      return {
        role: "button" as const,
        tabIndex: 0 as const,
        "aria-roledescription": "sortable" as const,
        "aria-label": `Reorder ${label} widget. Use Space to pick up, arrow keys to move, Space to drop.`,
        "aria-pressed": isKbDragging ? true : undefined,
        "aria-describedby": undefined,
      };
    },
    [engine, definitions, snapshot.phase],
  );

  // Wrap start drag to check locked
  const constrainedStartDrag = useCallback(
    (
      id: string,
      pointerId: number,
      initialPos: { x: number; y: number },
      element: HTMLElement,
      pointerType?: string,
    ) => {
      if (isWidgetLocked(id)) return;
      startDrag(id, pointerId, initialPos, element, pointerType);
    },
    [startDrag, isWidgetLocked],
  );

  // Keyboard drag handler
  const handleKeyboardDrag = useCallback(
    (widgetId: string, e: React.KeyboardEvent) => {
      handleKeyDown(widgetId, e);
    },
    [handleKeyDown],
  );

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcuts) return;
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      const isUndoKey =
        (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z";
      const isRedoKey =
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key === "z") || (!e.shiftKey && e.key === "y"));

      if (!isUndoKey && !isRedoKey) return;
      e.preventDefault();
      engine.dispatch({ type: isRedoKey ? "REDO" : "UNDO" });
    };

    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }, [keyboardShortcuts, containerRef, engine]);

  const state = engine.getState();
  const layout = snapshot.layout;

  const phase = snapshot.phase.type;

  const contextValue = useMemo(
    () => ({
      state,
      definitions,
      layout,
      actions,
      canUndo: snapshot.canUndo,
      canRedo: snapshot.canRedo,
      phase,
      dragState,
      getDragPosition,
      containerRef,
      measureRef,
      startDrag: constrainedStartDrag,
      updateDragPointer: () => {},  // No-op: engine handles pointer tracking
      endDrag: () => {},            // No-op: engine handles drop
      getA11yProps,
      handleKeyboardDrag,
      isWidgetLocked,
      isWidgetRemovable,
      isWidgetHideable,
      isWidgetResizable,
      canAddWidget,
    }),
    [state, definitions, layout, actions, snapshot.canUndo, snapshot.canRedo, phase, dragState, getDragPosition, containerRef, measureRef, constrainedStartDrag, getA11yProps, handleKeyboardDrag, isWidgetLocked, isWidgetRemovable, isWidgetHideable, isWidgetResizable, canAddWidget],
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
      <LiveRegion />
    </DashboardContext.Provider>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function resolveConstraint(
  id: string,
  _field: "locked",
  state: DashboardState,
  definitions: WidgetDefinition[],
): boolean {
  const widget = state.widgets.find((w) => w.id === id);
  if (widget?.locked != null) return widget.locked;
  if (!widget) return false;
  const def = definitions.find((d) => d.type === widget.type);
  return def?.locked === true;
}

function resolveDefConstraint(
  id: string,
  field: "removable" | "hideable" | "resizable",
  state: DashboardState,
  definitions: WidgetDefinition[],
): boolean {
  const widget = state.widgets.find((w) => w.id === id);
  if (!widget) return true;
  const def = definitions.find((d) => d.type === widget.type);
  return def?.[field] !== false;
}
