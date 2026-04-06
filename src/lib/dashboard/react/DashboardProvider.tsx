import { useCallback, useRef, useMemo, useEffect, useSyncExternalStore } from "react";
import type {
  DashboardProviderProps,
  DashboardState,
  DashboardStateInput,
  DashboardError,
  DragHandleA11yProps,
  LockType,
} from "../types.ts";
import { isLockActiveForWidget } from "../locks.ts";
import {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
} from "../constants.ts";
import { DashboardStableContext, DashboardDragContext, useActions } from "../state/use-dashboard.ts";
import { useDragEngine } from "./use-drag-engine.ts";
import { usePointerAdapter } from "./use-pointer-adapter.ts";
import { useKeyboardAdapter } from "./use-keyboard-adapter.ts";
import { useMeasurementBridge } from "./use-measurement-bridge.ts";
import { useAutoScroll } from "./use-auto-scroll.ts";
import { useDragAnnouncements } from "./use-drag-announcements.ts";
import {
  validateDefinitions,
  validateProviderProps,
  validateInitialWidgets,
} from "../validation.ts";
import { useMutationCallbacks } from "./use-mutation-callbacks.ts";
import { usePhaseCallbacks } from "./use-phase-callbacks.ts";
import { useDispatch } from "./use-dispatch.ts";
import { useUndoRedoShortcuts } from "./use-undo-redo-shortcuts.ts";
import { buildDragState, buildEngineConfig } from "./build-context-helpers.ts";

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

  // ── Error handling ──────────────────────────────────────────────────

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  const emitError = useCallback((error: DashboardError) => {
    onErrorRef.current?.(error);
  }, []);

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

  // ── Controlled / uncontrolled state resolution ──────────────────────

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

  const initialState: DashboardState = controlledStateInput
    ? { ...controlledStateInput, containerWidth: 0 }
    : {
        widgets: initialWidgets,
        maxColumns: Math.max(1, maxColumns),
        gap: Math.max(0, gap),
        containerWidth: 0,
      };

  // ── Engine, adapters, measurement ───────────────────────────────────

  const canDropRef = useRef(canDrop);
  useEffect(() => { canDropRef.current = canDrop; });

  const engineConfig = useMemo(
    () => buildEngineConfig(maxColumns, gap, dragConfig),
    [
      maxColumns,
      gap,
      dragConfig
    ],
  );

  const engine = useDragEngine(initialState, definitions, engineConfig, isControlled);

  const { measureRef, containerRef, containerCallbackRef } = useMeasurementBridge(engine);

  const { startDrag, clientPosRef } = usePointerAdapter(engine, containerRef);

  const { handleKeyDown } = useKeyboardAdapter(engine);

  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
  );

  // ── Announcements ───────────────────────────────────────────────────

  const { announce, LiveRegion } = useDragAnnouncements();
  useEffect(() => {
    if (snapshot.announcement) {
      announce(snapshot.announcement);
    }
  }, [snapshot.announcement, announce]);

  // ── Extracted hooks ─────────────────────────────────────────────────

  usePhaseCallbacks({ phase: snapshot.phase, onDragStart, onDragEnd });

  const getClientPointerForScroll = useCallback(() => clientPosRef.current, [clientPosRef]);
  const autoScrollEdgeSize = dragConfig?.autoScrollEdgeSize ?? AUTO_SCROLL_EDGE_SIZE;
  const autoScrollMaxSpeed = dragConfig?.autoScrollMaxSpeed ?? AUTO_SCROLL_MAX_SPEED;
  useAutoScroll(
    snapshot.phase.type === "dragging",
    getClientPointerForScroll,
    autoScrollEdgeSize,
    autoScrollMaxSpeed,
  );

  const fireMutationCallbacks = useMutationCallbacks({
    onWidgetAdd,
    onWidgetRemove,
    onWidgetResize,
    onWidgetReorder,
    onWidgetConfigChange,
  });

  const dispatch = useDispatch(engine, onStateChange, fireMutationCallbacks);

  useUndoRedoShortcuts(keyboardShortcuts, containerRef, engine);

  // ── Actions & helpers ───────────────────────────────────────────────

  const getState = useCallback(() => engine.getState(), [engine]);
  const actions = useActions({ dispatch, definitions, getState, maxWidgets, onError: emitError });

  const isWidgetLockActive = useCallback(
    (id: string, lockType: LockType) => {
      const widget = engine.getWidgetById(id);
      return widget ? isLockActiveForWidget(widget, lockType, definitions) : false;
    },
    [engine, definitions],
  );
  const canAddWidget = useCallback(
    () => maxWidgets == null || engine.getState().widgets.length < maxWidgets,
    [engine, maxWidgets],
  );

  // ── Drag state & position ──────────────────────────────────────────

  const dragState = useMemo(
    () => buildDragState(snapshot),
    [snapshot],
  );

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

  // ── Context values ──────────────────────────────────────────────────

  const state = engine.getState();
  const layout = snapshot.layout;
  const phase = snapshot.phase.type;

  const stableValue = useMemo(
    () => ({
      state,
      definitions,
      layout,
      actions,
      canUndo: snapshot.canUndo,
      canRedo: snapshot.canRedo,
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
    [state, definitions, layout, actions, snapshot.canUndo, snapshot.canRedo, getDragPosition, containerCallbackRef, measureRef, constrainedStartDrag, getA11yProps, handleKeyboardDrag, isWidgetLockActive, canAddWidget],
  );

  const dragValue = useMemo(
    () => ({ phase, dragState }),
    [phase, dragState],
  );

  // ── onChange (skip first render) ────────────────────────────────────

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    onChangeRef.current?.(state);
  }, [state]);

  return (
    <DashboardStableContext.Provider value={stableValue}>
      <DashboardDragContext.Provider value={dragValue}>
        {children}
        <LiveRegion />
      </DashboardDragContext.Provider>
    </DashboardStableContext.Provider>
  );
}
