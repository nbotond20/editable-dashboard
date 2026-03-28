import { useCallback, useRef, useMemo, useEffect, useSyncExternalStore } from "react";
import type {
  DashboardProviderProps,
  DashboardState,
  DashboardStateInput,
  DashboardError,
  DashboardAction,
  DragHandleA11yProps,
  DragState,
  WidgetDefinition,
  LockType,
} from "../types.ts";
import type { CommittedOperation } from "../engine/types.ts";
import {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
} from "../constants.ts";
import { dashboardReducer } from "../state/dashboard-reducer.ts";
import { DashboardContext, useActions } from "../state/use-dashboard.ts";
import { useDragEngine } from "./use-drag-engine.ts";
import { usePointerAdapter } from "./use-pointer-adapter.ts";
import { useKeyboardAdapter } from "./use-keyboard-adapter.ts";
import { useMeasurementBridge } from "./use-measurement-bridge.ts";
import { useAutoScroll } from "../drag/use-auto-scroll.ts";
import { useDragAnnouncements } from "../drag/use-drag-announcements.ts";
import {
  validateDefinitions,
  validateProviderProps,
  validateInitialWidgets,
} from "../validation.ts";

/**
 * Root provider component for the dashboard.
 *
 * Manages the drag engine, pointer/keyboard adapters, widget measurement,
 * undo/redo history, auto-scroll, and accessibility announcements.
 *
 * Wrap your grid UI in this provider, then use {@link useDashboard} to access
 * state, layout, and actions from any descendant component.
 *
 * @see {@link DashboardProviderProps} for configuration options.
 */
export function DashboardProvider(props: DashboardProviderProps) {
  const {
    definitions,
    maxColumns = DEFAULT_MAX_COLUMNS,
    gap = DEFAULT_GAP,
    maxWidgets,
    maxUndoDepth,
    keyboardShortcuts = true,
    canDrop,
    dragConfig,
    onError,
    onDragStart,
    onDragEnd,
    onWidgetAdd,
    onWidgetRemove,
    onWidgetResize,
    onWidgetReorder,
    onWidgetConfigChange,
    onChange,
    children,
  } = props;

  // ── Error handling refs ─────────────────────────────────────────────────
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  const emitError = useCallback((error: DashboardError) => {
    onErrorRef.current?.(error);
  }, []);

  // --- Input validation (runs once on mount and when deps change) ---
  useEffect(() => {
    for (const err of validateDefinitions(definitions)) {
      emitError(err);
    }
  }, [definitions, emitError]);

  useEffect(() => {
    for (const err of validateProviderProps({ maxColumns, gap, maxUndoDepth })) {
      emitError(err);
    }
  }, [maxColumns, gap, maxUndoDepth, emitError]);

  // ── Lifecycle callback refs (avoid stale closures & re-renders) ──────
  const onDragStartRef = useRef(onDragStart);
  useEffect(() => { onDragStartRef.current = onDragStart; });
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => { onDragEndRef.current = onDragEnd; });
  const onWidgetAddRef = useRef(onWidgetAdd);
  useEffect(() => { onWidgetAddRef.current = onWidgetAdd; });
  const onWidgetRemoveRef = useRef(onWidgetRemove);
  useEffect(() => { onWidgetRemoveRef.current = onWidgetRemove; });
  const onWidgetResizeRef = useRef(onWidgetResize);
  useEffect(() => { onWidgetResizeRef.current = onWidgetResize; });
  const onWidgetReorderRef = useRef(onWidgetReorder);
  useEffect(() => { onWidgetReorderRef.current = onWidgetReorder; });
  const onWidgetConfigChangeRef = useRef(onWidgetConfigChange);
  useEffect(() => { onWidgetConfigChangeRef.current = onWidgetConfigChange; });
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const isControlled = "state" in props && props.state !== undefined;
  const rawInitialWidgets =
    !isControlled && "initialWidgets" in props && props.initialWidgets
      ? props.initialWidgets
      : [];
  const controlledStateInput = isControlled
    ? (props as { state: DashboardStateInput }).state
    : undefined;
  const onStateChange = isControlled
    ? (props as { onStateChange: (s: DashboardStateInput) => void }).onStateChange
    : undefined;

  // Validate and filter initialWidgets (graceful degradation: skip unknown types)
  const { validWidgets: initialWidgets } = useMemo(
    () => {
      const result = validateInitialWidgets(rawInitialWidgets, definitions);
      for (const err of result.errors) {
        onErrorRef.current?.(err);
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
    [],
  );

  // In controlled mode, merge the externally provided state with the
  // internally tracked containerWidth. Consumers never manage containerWidth.
  const initialState: DashboardState = controlledStateInput
    ? { ...controlledStateInput, containerWidth: 0 }
    : {
        widgets: initialWidgets,
        maxColumns: Math.max(1, maxColumns),
        gap: Math.max(0, gap),
        containerWidth: 0,
      };

  const canDropRef = useRef(canDrop);
  useEffect(() => { canDropRef.current = canDrop; });

  const engineConfig = useMemo(() => ({
    maxColumns,
    gap,
    ...(dragConfig?.activationThreshold != null && { activationThreshold: dragConfig.activationThreshold }),
    ...(dragConfig?.touchActivationDelay != null && { touchActivationDelay: dragConfig.touchActivationDelay }),
    ...(dragConfig?.touchMoveTolerance != null && { touchMoveTolerance: dragConfig.touchMoveTolerance }),
    ...(dragConfig?.swapDwellMs != null && { swapDwellMs: dragConfig.swapDwellMs }),
    ...(dragConfig?.resizeDwellMs != null && { resizeDwellMs: dragConfig.resizeDwellMs }),
    ...(dragConfig?.dropAnimationDuration != null && { dropAnimationDuration: dragConfig.dropAnimationDuration }),
  }), [
    maxColumns,
    gap,
    dragConfig?.activationThreshold,
    dragConfig?.touchActivationDelay,
    dragConfig?.touchMoveTolerance,
    dragConfig?.swapDwellMs,
    dragConfig?.resizeDwellMs,
    dragConfig?.dropAnimationDuration,
  ]);

  const engine = useDragEngine(initialState, definitions, engineConfig);

  const { measureRef, containerRef, containerCallbackRef } = useMeasurementBridge(engine);

  const { startDrag } = usePointerAdapter(engine, containerRef);

  const { handleKeyDown } = useKeyboardAdapter(engine);

  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
  );

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; });

  const { announce, LiveRegion } = useDragAnnouncements();
  useEffect(() => {
    if (snapshot.announcement) {
      announce(snapshot.announcement);
    }
  }, [snapshot.announcement, announce]);

  // ── Drag lifecycle callbacks ────────────────────────────────────────────
  const prevPhaseRef = useRef(snapshot.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = snapshot.phase;
    prevPhaseRef.current = curr;

    // Detect drag start: idle/pending -> dragging or idle -> keyboard-dragging
    if (curr.type === "dragging" && prev.type !== "dragging") {
      onDragStartRef.current?.({ widgetId: curr.sourceId, phase: "pointer" });
    } else if (curr.type === "keyboard-dragging" && prev.type !== "keyboard-dragging") {
      onDragStartRef.current?.({ widgetId: curr.sourceId, phase: "keyboard" });
    }

    // Detect drag end: dropping -> idle (pointer drag completed animation)
    if (curr.type === "idle" && prev.type === "dropping") {
      onDragEndRef.current?.({
        widgetId: prev.sourceId,
        operation: prev.operation,
        cancelled: prev.operation.type === "cancelled",
      });
    }

    // Detect drag end: dragging -> idle (pointer drag cancelled, no dropping phase)
    if (curr.type === "idle" && prev.type === "dragging") {
      const cancelledOp: CommittedOperation = { type: "cancelled" };
      onDragEndRef.current?.({
        widgetId: prev.sourceId,
        operation: cancelledOp,
        cancelled: true,
      });
    }

    // Detect drag end: keyboard-dragging -> idle (keyboard drop or cancel)
    if (curr.type === "idle" && prev.type === "keyboard-dragging") {
      const wasCancelled = prev.currentIndex === prev.originalIndex && prev.currentColSpan === prev.originalColSpan;
      const operation: CommittedOperation = wasCancelled
        ? { type: "cancelled" }
        : { type: "reorder", fromIndex: prev.originalIndex, toIndex: prev.currentIndex };
      onDragEndRef.current?.({
        widgetId: prev.sourceId,
        operation,
        cancelled: wasCancelled,
      });
    }
  }, [snapshot.phase]);

  // ── Auto-scroll (perf: ref-based getDragPosition) ──────────────────────
  const dragPositionRef = useRef(snapshot.dragPosition);
  dragPositionRef.current = snapshot.dragPosition;
  const getDragPositionForScroll = useCallback(() => dragPositionRef.current, []);
  const autoScrollEdgeSize = dragConfig?.autoScrollEdgeSize ?? AUTO_SCROLL_EDGE_SIZE;
  const autoScrollMaxSpeed = dragConfig?.autoScrollMaxSpeed ?? AUTO_SCROLL_MAX_SPEED;
  useAutoScroll(
    snapshot.phase.type === "dragging",
    getDragPositionForScroll,
    autoScrollEdgeSize,
    autoScrollMaxSpeed,
  );

  // ── Widget mutation callback helper ──────────────────────────────────────
  const fireMutationCallbacks = useCallback(
    (action: DashboardAction, prevState: DashboardState, nextState: DashboardState) => {
      if (nextState === prevState) return; // no-op, state didn't change

      switch (action.type) {
        case "ADD_WIDGET": {
          const newWidget = nextState.widgets.find(
            (w) => !prevState.widgets.some((pw) => pw.id === w.id),
          );
          if (newWidget) {
            onWidgetAddRef.current?.({ widget: newWidget });
          }
          break;
        }
        case "REMOVE_WIDGET":
          onWidgetRemoveRef.current?.({ widgetId: action.id });
          break;
        case "RESIZE_WIDGET": {
          const prevWidget = prevState.widgets.find((w) => w.id === action.id);
          const nextWidget = nextState.widgets.find((w) => w.id === action.id);
          if (prevWidget && nextWidget && prevWidget.colSpan !== nextWidget.colSpan) {
            onWidgetResizeRef.current?.({
              widgetId: action.id,
              previousColSpan: prevWidget.colSpan,
              newColSpan: nextWidget.colSpan,
            });
          }
          break;
        }
        case "REORDER_WIDGETS":
          if (action.fromIndex !== action.toIndex) {
            const visible = [...prevState.widgets]
              .filter((w) => w.visible)
              .sort((a, b) => a.order - b.order);
            const movedWidget = visible[action.fromIndex];
            if (movedWidget) {
              onWidgetReorderRef.current?.({
                widgetId: movedWidget.id,
                fromIndex: action.fromIndex,
                toIndex: action.toIndex,
              });
            }
          }
          break;
        case "UPDATE_WIDGET_CONFIG":
          onWidgetConfigChangeRef.current?.({
            widgetId: action.id,
            config: action.config,
          });
          break;
      }
    },
    [],
  );

  const dispatch = useCallback(
    (action: DashboardAction) => {
      const prevState = engine.getState();

      if (onStateChangeRef.current) {
        const nextState = dashboardReducer(prevState, action);
        // Strip transient containerWidth before emitting to controlled consumers
        onStateChangeRef.current({
          widgets: nextState.widgets,
          maxColumns: nextState.maxColumns,
          gap: nextState.gap,
        });
        fireMutationCallbacks(action, prevState, nextState);
      } else {
        engine.dispatch(action);
        const nextState = engine.getState();
        fireMutationCallbacks(action, prevState, nextState);
      }
    },
    [engine, fireMutationCallbacks],
  );

  const getState = useCallback(() => engine.getState(), [engine]);
  const actions = useActions({ dispatch, definitions, getState, maxWidgets, onError: emitError });

  const isWidgetLockActive = useCallback(
    (id: string, lockType: LockType) => resolveLock(id, lockType, engine.getState(), definitions),
    [engine, definitions],
  );
  const canAddWidget = useCallback(
    () => maxWidgets == null || engine.getState().widgets.length < maxWidgets,
    [engine, maxWidgets],
  );

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
  }, [snapshot.phase, snapshot.intent, snapshot.previewLayout]);

  const getDragPosition = useCallback(
    () => engine.getDragPosition(),
    [engine],
  );

  const phaseRef = useRef(snapshot.phase);
  phaseRef.current = snapshot.phase;

  const getA11yProps = useCallback(
    (widgetId: string): DragHandleA11yProps => {
      const widget = engine.getState().widgets.find((w) => w.id === widgetId);
      const def = widget ? definitions.find((d) => d.type === widget.type) : undefined;
      const label = def?.label ?? widget?.type ?? "Unknown";

      const currentPhase = phaseRef.current;
      const isKbDragging =
        currentPhase.type === "keyboard-dragging" &&
        currentPhase.sourceId === widgetId;

      return {
        role: "button" as const,
        tabIndex: 0 as const,
        "aria-roledescription": "sortable" as const,
        "aria-label": `Reorder ${label} widget. Use Space to pick up, arrow keys to move, Space to drop.`,
        "aria-pressed": isKbDragging ? true : undefined,
        "aria-describedby": undefined,
      };
    },
    [engine, definitions],
  );

  const constrainedStartDrag = useCallback(
    (
      id: string,
      pointerId: number,
      initialPos: { x: number; y: number },
      element: HTMLElement,
      pointerType?: string,
    ) => {
      if (isWidgetLockActive(id, "position")) return;
      startDrag(id, pointerId, initialPos, element, pointerType);
    },
    [startDrag, isWidgetLockActive],
  );

  const handleKeyboardDrag = useCallback(
    (widgetId: string, e: React.KeyboardEvent) => {
      handleKeyDown(widgetId, e);
    },
    [handleKeyDown],
  );

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
      containerRef: containerCallbackRef,
      measureRef,
      startDrag: constrainedStartDrag,
      updateDragPointer: () => {},
      endDrag: () => {},
      getA11yProps,
      handleKeyboardDrag,
      isWidgetLockActive,
      canAddWidget,
    }),
    [state, definitions, layout, actions, snapshot.canUndo, snapshot.canRedo, phase, dragState, getDragPosition, containerCallbackRef, measureRef, constrainedStartDrag, getA11yProps, handleKeyboardDrag, isWidgetLockActive, canAddWidget],
  );

  // ── onChange callback (fires in both controlled and uncontrolled modes) ─
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    onChangeRef.current?.(state);
  }, [state]);

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
      <LiveRegion />
    </DashboardContext.Provider>
  );
}

function lockFieldName(lockType: LockType): "lockPosition" | "lockResize" | "lockRemove" {
  switch (lockType) {
    case "position": return "lockPosition";
    case "resize": return "lockResize";
    case "remove": return "lockRemove";
  }
}

function resolveLock(
  id: string,
  lockType: LockType,
  state: DashboardState,
  definitions: WidgetDefinition[],
): boolean {
  const widget = state.widgets.find((w) => w.id === id);
  if (!widget) return false;
  const field = lockFieldName(lockType);
  if (widget[field] != null) return widget[field]!;
  const def = definitions.find((d) => d.type === widget.type);
  return def?.[field] === true;
}
