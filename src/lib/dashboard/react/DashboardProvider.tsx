import { useCallback, useRef, useMemo, useEffect, useSyncExternalStore } from "react";
import type {
  DashboardProviderProps,
  DashboardState,
  DashboardError,
  DragHandleA11yProps,
  LockType,
  WidgetState,
} from "../types.ts";
import type { CommitSource } from "../engine/types.ts";
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
import { useExternalDropTarget } from "./use-external-drop-target.ts";
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
    doubleClickToMaximize = true,
    canDrop,
    dragConfig,
    enableExternalDrag,
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

  const isControlled = "state" in props && props.state !== undefined;
  const rawInitialWidgets =
    !isControlled && "initialWidgets" in props && props.initialWidgets
      ? props.initialWidgets
      : [];
  const controlledWidgets = isControlled
    ? (props as { state: WidgetState[] }).state
    : undefined;
  const onStateChange = isControlled
    ? (props as { onStateChange: (widgets: WidgetState[]) => void }).onStateChange
    : undefined;

  if (import.meta.env.DEV) {

    const wasControlledRef = useRef(isControlled);
    if (wasControlledRef.current !== isControlled) {
      console.warn(
        "DashboardProvider: switching between controlled and uncontrolled mode is not supported. " +
        "Decide between using `state` (controlled) or `initialWidgets` (uncontrolled) for the lifetime of the component.",
      );
    }
    wasControlledRef.current = isControlled;
  }

  const { validWidgets: initialWidgets } = useMemo(
    () => {
      const result = validateInitialWidgets(rawInitialWidgets, definitions);
      for (const err of result.errors) {
        onErrorRef.current?.(err);
      }
      return result;
    },

    [],
  );

  const initialState: DashboardState = controlledWidgets
    ? {
        widgets: controlledWidgets,
        maxColumns: Math.max(1, maxColumns),
        gap: Math.max(0, gap),
        containerWidth: 0,
      }
    : {
        widgets: initialWidgets,
        maxColumns: Math.max(1, maxColumns),
        gap: Math.max(0, gap),
        containerWidth: 0,
      };

  const { fireMutationCallbacks, fireDragCommitCallbacks } = useMutationCallbacks({
    onWidgetAdd,
    onWidgetRemove,
    onWidgetResize,
    onWidgetReorder,
    onWidgetConfigChange,
  });

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; });

  const fireDragCommitCallbacksRef = useRef(fireDragCommitCallbacks);
  useEffect(() => { fireDragCommitCallbacksRef.current = fireDragCommitCallbacks; });

  const onCommit = useCallback(
    (nextState: DashboardState, prevState: DashboardState, source: CommitSource) => {
      fireDragCommitCallbacksRef.current(source, prevState, nextState);

      onStateChangeRef.current?.(nextState.widgets);
    },
    [],
  );

  const canDropRef = useRef(canDrop);
  useEffect(() => { canDropRef.current = canDrop; });

  const engineConfig = useMemo(
    () => ({
      ...buildEngineConfig(maxColumns, gap, dragConfig),
      ...(maxUndoDepth != null ? { maxUndoDepth } : {}),
      onCommit,
    }),
    [
      maxColumns,
      gap,
      dragConfig,
      maxUndoDepth,
      onCommit,
    ],
  );

  const controlledState: DashboardState | undefined = controlledWidgets
    ? {
        widgets: controlledWidgets,
        maxColumns: Math.max(1, maxColumns),
        gap: Math.max(0, gap),
        containerWidth: 0,
      }
    : undefined;

  const engine = useDragEngine(
    controlledState ?? initialState,
    definitions,
    engineConfig,
    isControlled,
  );

  useEffect(() => {
    return () => {
      engine.destroy();
    };
  }, [engine]);

  const { measureRef, containerRef, containerCallbackRef } = useMeasurementBridge(engine);

  const trashElementRef = useRef<HTMLElement | null>(null);
  const registerTrashZone = useCallback((el: HTMLElement | null) => {
    trashElementRef.current = el;
  }, []);

  useEffect(() => {
    engine.updateConfig({
      getTrashRect: () => {
        const trash = trashElementRef.current;
        const container = containerRef.current;
        if (!trash || !container) return null;
        const trashRect = trash.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return {
          left: trashRect.left - containerRect.left + container.scrollLeft,
          top: trashRect.top - containerRect.top + container.scrollTop,
          right: trashRect.right - containerRect.left + container.scrollLeft,
          bottom: trashRect.bottom - containerRect.top + container.scrollTop,
        };
      },
    });
  }, [engine, containerRef]);

  useExternalDropTarget(engine, containerRef, definitions, enableExternalDrag ?? false);

  const { startDrag, clientPosRef } = usePointerAdapter(engine, containerRef);

  const { handleKeyDown } = useKeyboardAdapter(engine);

  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
  );

  const { announce, LiveRegion } = useDragAnnouncements();
  useEffect(() => {
    if (snapshot.announcement) {
      announce(snapshot.announcement);
    }
  }, [snapshot.announcement, announce]);

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

  const dispatch = useDispatch(engine, fireMutationCallbacks);

  useUndoRedoShortcuts(keyboardShortcuts, containerRef, dispatch);

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
      doubleClickToMaximize,
      registerTrashZone,
    }),
    [state, definitions, layout, actions, snapshot.canUndo, snapshot.canRedo, getDragPosition, containerCallbackRef, measureRef, constrainedStartDrag, getA11yProps, handleKeyboardDrag, isWidgetLockActive, canAddWidget, doubleClickToMaximize, registerTrashZone],
  );

  const dragValue = useMemo(
    () => ({ phase, dragState }),
    [phase, dragState],
  );

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
