import { useCallback, useRef, useMemo, useEffect } from "react";
import type {
  DashboardProviderProps,
  DashboardState,
  DashboardAction,
  DragHandleA11yProps,
  DragState,
} from "../types.ts";
import { DEFAULT_MAX_COLUMNS, DEFAULT_GAP } from "../constants.ts";
import { dashboardReducer } from "../state/dashboard-reducer.ts";
import { DashboardContext, useActions } from "../state/use-dashboard.ts";
import { useLayoutEngine } from "../layout/use-layout-engine.ts";
import { useDragSystem } from "../drag/use-widget-drag.ts";
import { useAutoScroll } from "../drag/use-auto-scroll.ts";
import { useKeyboardDrag } from "../drag/use-keyboard-drag.ts";
import { useDragAnnouncements } from "../drag/use-drag-announcements.ts";
import { useUndoReducer } from "../state/use-undo-reducer.ts";

export function DashboardProvider(props: DashboardProviderProps) {
  const {
    definitions,
    maxColumns = DEFAULT_MAX_COLUMNS,
    gap = DEFAULT_GAP,
    maxWidgets,
    maxUndoDepth = 50,
    keyboardShortcuts = true,
    canDrop,
    children,
  } = props;

  const isControlled = "state" in props && props.state !== undefined;

  // --- Uncontrolled mode (with undo history) ------------------------------
  const initialWidgets =
    !isControlled && "initialWidgets" in props && props.initialWidgets
      ? props.initialWidgets
      : [];

  const {
    state: internalState,
    dispatch: internalDispatch,
    canUndo: internalCanUndo,
    canRedo: internalCanRedo,
  } = useUndoReducer(
    {
      widgets: initialWidgets,
      maxColumns,
      gap,
      containerWidth: 0,
    } satisfies DashboardState,
    maxUndoDepth
  );

  // --- Controlled mode ---------------------------------------------------
  const controlledState = isControlled ? (props as { state: DashboardState }).state : undefined;
  const onStateChange = isControlled
    ? (props as { onStateChange: (s: DashboardState) => void }).onStateChange
    : undefined;

  // The effective state the rest of the component uses.
  const state = controlledState ?? internalState;
  const canUndo = isControlled ? false : internalCanUndo;
  const canRedo = isControlled ? false : internalCanRedo;

  // Dispatch wrapper: in controlled mode, run the reducer to compute the
  // next state and hand it to the parent via onStateChange. In uncontrolled
  // mode, simply forward to the internal dispatch.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; });

  const dispatch = useCallback(
    (action: DashboardAction) => {
      if (onStateChangeRef.current) {
        const nextState = dashboardReducer(stateRef.current, action);
        onStateChangeRef.current(nextState);
      } else {
        internalDispatch(action);
      }
    },
    [internalDispatch]
  );

  const getState = useCallback(() => stateRef.current, []);
  const actions = useActions({ dispatch, definitions, getState, maxWidgets });

  const onContainerWidth = useCallback(
    (width: number) => dispatch({ type: "SET_CONTAINER_WIDTH", width }),
    [dispatch]
  );

  const { layout, containerRef, measureRef, computePreviewLayout } =
    useLayoutEngine(state, onContainerWidth);

  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; });
  const widgetsRef = useRef(state.widgets);
  useEffect(() => { widgetsRef.current = state.widgets; });

  const getLayout = useCallback(() => layoutRef.current, []);
  const getWidgets = useCallback(() => widgetsRef.current, []);

  // --- Constraint helpers --------------------------------------------------
  // Defined before the drag system so they can be passed down.
  const canDropRef = useRef(canDrop);
  useEffect(() => { canDropRef.current = canDrop; });

  const isWidgetLocked = useCallback(
    (id: string): boolean => {
      const s = stateRef.current;
      const widget = s.widgets.find((w) => w.id === id);
      if (widget?.locked != null) return widget.locked;
      if (!widget) return false;
      const def = definitions.find((d) => d.type === widget.type);
      return def?.locked === true;
    },
    [definitions]
  );

  const isWidgetRemovable = useCallback(
    (id: string): boolean => {
      const s = stateRef.current;
      const widget = s.widgets.find((w) => w.id === id);
      if (!widget) return true;
      const def = definitions.find((d) => d.type === widget.type);
      return def?.removable !== false;
    },
    [definitions]
  );

  const isWidgetHideable = useCallback(
    (id: string): boolean => {
      const s = stateRef.current;
      const widget = s.widgets.find((w) => w.id === id);
      if (!widget) return true;
      const def = definitions.find((d) => d.type === widget.type);
      return def?.hideable !== false;
    },
    [definitions]
  );

  const isWidgetResizable = useCallback(
    (id: string): boolean => {
      const s = stateRef.current;
      const widget = s.widgets.find((w) => w.id === id);
      if (!widget) return true;
      const def = definitions.find((d) => d.type === widget.type);
      return def?.resizable !== false;
    },
    [definitions]
  );

  const canAddWidget = useCallback(
    (): boolean => {
      if (maxWidgets == null) return true;
      return stateRef.current.widgets.length < maxWidgets;
    },
    [maxWidgets]
  );

  // --- Drag system (with constraint integration) ---------------------------
  const { dragState: pointerDragState, startDrag, updateDragPointer, endDrag, getDragPosition, getPointerPosition } = useDragSystem({
    getLayout,
    getWidgets,
    getState,
    maxColumns: state.maxColumns,
    containerRef,
    onReorder: actions.reorderWidgets,
    onBatchUpdate: actions.batchUpdate,
    computePreviewLayout,
    isLocked: isWidgetLocked,
    canDrop,
  });

  // --- Auto-scroll while dragging ------------------------------------------
  useAutoScroll(pointerDragState.activeId !== null, getPointerPosition);

  // --- Keyboard drag & live announcements ---------------------------------
  const { announce, LiveRegion } = useDragAnnouncements();

  const { kbState, handleKeyDown: handleKbKeyDown } = useKeyboardDrag({
    getWidgets,
    definitions,
    maxColumns: state.maxColumns,
    onReorder: actions.reorderWidgets,
    onResize: actions.resizeWidget,
    announce,
  });

  // Merge drag states: keyboard drag takes precedence when active.
  const dragState: DragState = useMemo(
    () =>
      kbState.isKeyboardDragging
        ? {
            activeId: kbState.keyboardDragId,
            dropTargetIndex: kbState.keyboardTargetIndex,
            previewColSpan: null,
            previewLayout: null,
            isLongPressing: false,
            longPressTargetId: null,
          }
        : pointerDragState,
    [kbState, pointerDragState]
  );

  // --- ARIA props helper --------------------------------------------------
  const getA11yProps = useCallback(
    (widgetId: string): DragHandleA11yProps => {
      const widgets = getWidgets();
      const widget = widgets.find((w) => w.id === widgetId);
      const def = widget
        ? definitions.find((d) => d.type === widget.type)
        : undefined;
      const label = def?.label ?? widget?.type ?? "Unknown";

      return {
        role: "button" as const,
        tabIndex: 0 as const,
        "aria-roledescription": "sortable" as const,
        "aria-label": `Reorder ${label} widget. Use Space to pick up, arrow keys to move, Space to drop.`,
        "aria-pressed":
          kbState.isKeyboardDragging && kbState.keyboardDragId === widgetId
            ? true
            : undefined,
        "aria-describedby": undefined,
      };
    },
    [getWidgets, definitions, kbState]
  );

  // Expose keyboard drag handler for consumers to wire into drag handles.
  const handleKeyboardDrag = useCallback(
    (widgetId: string, e: React.KeyboardEvent) => {
      handleKbKeyDown(widgetId, e);
    },
    [handleKbKeyDown]
  );

  // --- Undo/redo keyboard shortcuts ---------------------------------------
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
      dispatch({ type: isRedoKey ? "REDO" : "UNDO" });
    };

    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }, [keyboardShortcuts, containerRef, dispatch]);

  // Wrap startDrag to prevent dragging locked widgets.
  const constrainedStartDrag = useCallback(
    (
      id: string,
      pointerId: number,
      initialPos: { x: number; y: number },
      element: HTMLElement,
      pointerType?: string
    ) => {
      if (isWidgetLocked(id)) return;
      startDrag(id, pointerId, initialPos, element, pointerType);
    },
    [startDrag, isWidgetLocked]
  );

  const contextValue = useMemo(
    () => ({
      state,
      definitions,
      layout,
      actions,
      canUndo,
      canRedo,
      dragState,
      getDragPosition,
      containerRef,
      measureRef,
      startDrag: constrainedStartDrag,
      updateDragPointer,
      endDrag,
      getA11yProps,
      handleKeyboardDrag,
      isWidgetLocked,
      isWidgetRemovable,
      isWidgetHideable,
      isWidgetResizable,
      canAddWidget,
    }),
    [state, definitions, layout, actions, canUndo, canRedo, dragState, getDragPosition, containerRef, measureRef, constrainedStartDrag, updateDragPointer, endDrag, getA11yProps, handleKeyboardDrag, isWidgetLocked, isWidgetRemovable, isWidgetHideable, isWidgetResizable, canAddWidget]
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
      <LiveRegion />
    </DashboardContext.Provider>
  );
}
