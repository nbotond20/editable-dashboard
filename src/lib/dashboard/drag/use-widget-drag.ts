import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DashboardState,
  DragState,
  ComputedLayout,
  WidgetState,
  DropTarget,
} from "../types.ts";
import {
  DRAG_ACTIVATION_THRESHOLD,
  TOUCH_DRAG_ACTIVATION_DELAY,
  TOUCH_MOVE_TOLERANCE,
} from "../constants.ts";
import { computeDropTarget } from "./drop-indicator.ts";

interface UseDragSystemOptions {
  getLayout: () => ComputedLayout;
  getWidgets: () => WidgetState[];
  getState: () => DashboardState;
  maxColumns: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onBatchUpdate: (widgets: WidgetState[]) => void;
  computePreviewLayout: (tentativeWidgets: WidgetState[]) => ComputedLayout;
  isLocked?: (id: string) => boolean;
  canDrop?: (sourceId: string, targetIndex: number, state: DashboardState) => boolean;
}

const INITIAL_DRAG_STATE: DragState = {
  activeId: null,
  dropTargetIndex: null,
  previewColSpan: null,
  previewLayout: null,
  isLongPressing: false,
  longPressTargetId: null,
};

export function useDragSystem(options: UseDragSystemOptions) {
  const {
    getLayout,
    getWidgets,
    getState,
    maxColumns,
    containerRef,
    onReorder,
    onBatchUpdate,
    computePreviewLayout,
    isLocked,
    canDrop,
  } = options;

  const isLockedRef = useRef(isLocked);
  useEffect(() => { isLockedRef.current = isLocked; });
  const canDropRef = useRef(canDrop);
  useEffect(() => { canDropRef.current = canDrop; });

  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const initialPosRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef<{
    id: string;
    pointerId: number;
    element: HTMLElement;
    activated: boolean;
    pointerType: string;
  } | null>(null);
  const rafRef = useRef<number>(0);
  const lastDropTarget = useRef<DropTarget | null>(null);
  const grabOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pendingTargetRef = useRef<{ target: DropTarget | null; frames: number }>({
    target: null,
    frames: 0,
  });

  // --- Long-press timer for touch -------------------------------------------
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // --- Listener management --------------------------------------------------
  const listenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    key: (e: KeyboardEvent) => void;
    abort: () => void;
  } | null>(null);

  const removeAllListeners = useCallback(() => {
    const l = listenersRef.current;
    if (!l) return;
    document.removeEventListener("pointermove", l.move);
    document.removeEventListener("pointerup", l.up);
    document.removeEventListener("keydown", l.key);
    document.removeEventListener("pointercancel", l.abort);
    document.removeEventListener("visibilitychange", l.abort);
    listenersRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  /** Shared helper: activates the drag once threshold / long-press is met. */
  const activateDrag = useCallback(
    (active: NonNullable<typeof activeRef.current>) => {
      active.activated = true;

      const initial = initialPosRef.current;
      const container = containerRef.current;
      const currentLayout = getLayout();
      const widgetPos = currentLayout.positions.get(active.id);

      if (container && widgetPos && initial) {
        const rect = container.getBoundingClientRect();
        grabOffsetRef.current = {
          x: initial.x - (rect.left + widgetPos.x),
          y: initial.y - (rect.top + widgetPos.y),
        };
      }

      dragPositionRef.current = widgetPos
        ? { x: widgetPos.x, y: widgetPos.y }
        : null;
      setDragState((prev) => ({
        ...prev,
        activeId: active.id,
        isLongPressing: false,
        longPressTargetId: null,
      }));
    },
    [containerRef, getLayout]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const active = activeRef.current;
      if (!active) return;

      const pos = { x: e.clientX, y: e.clientY };
      pointerRef.current = pos;

      if (!active.activated) {
        const initial = initialPosRef.current;
        if (!initial) return;
        const dist = Math.hypot(pos.x - initial.x, pos.y - initial.y);

        if (active.pointerType === "touch") {
          // Touch: if the user moves more than tolerance during long-press,
          // they are scrolling — cancel the long-press and the whole gesture.
          if (dist > TOUCH_MOVE_TOLERANCE) {
            clearLongPressTimer();
            setDragState((prev) => ({
              ...prev,
              isLongPressing: false,
              longPressTargetId: null,
            }));
            // Abort the drag attempt entirely so the browser can scroll.
            removeAllListeners();
            activeRef.current = null;
            initialPosRef.current = null;
            pointerRef.current = null;
            return;
          }
          // While waiting for the long-press timer we don't activate on distance.
          return;
        }

        // Mouse / pen: existing 5px threshold activation
        if (dist < DRAG_ACTIVATION_THRESHOLD) return;
        activateDrag(active);
      }

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container || !pointerRef.current) return;

        const rect = container.getBoundingClientRect();
        const widgets = getWidgets();

        dragPositionRef.current = grabOffsetRef.current
          ? {
              x: pointerRef.current.x - rect.left - grabOffsetRef.current.x,
              y: pointerRef.current.y - rect.top - grabOffsetRef.current.y,
            }
          : null;

        const result = computeDropTarget(
          pointerRef.current.x,
          pointerRef.current.y,
          widgets,
          maxColumns,
          active.id,
          rect,
          computePreviewLayout,
          isLockedRef.current
        );

        const dropTarget = result?.dropTarget ?? null;
        const previewLayout = result?.previewLayout ?? null;

        const prev = lastDropTarget.current;
        const targetChanged =
          dropTarget?.targetIndex !== prev?.targetIndex ||
          dropTarget?.previewColSpan !== prev?.previewColSpan ||
          dropTarget?.columnStart !== prev?.columnStart ||
          dropTarget?.swapWithId !== prev?.swapWithId;

        let shouldSwitch = false;
        if (targetChanged) {
          const pending = pendingTargetRef.current;
          const sameAsPending =
            dropTarget?.targetIndex === pending.target?.targetIndex &&
            dropTarget?.previewColSpan === pending.target?.previewColSpan &&
            dropTarget?.columnStart === pending.target?.columnStart &&
            dropTarget?.swapWithId === pending.target?.swapWithId;

          if (sameAsPending) {
            pending.frames++;
            shouldSwitch = pending.frames >= 2;
          } else {
            pendingTargetRef.current = { target: dropTarget, frames: 1 };
            shouldSwitch = prev == null || dropTarget == null;
          }
        } else {
          pendingTargetRef.current = { target: null, frames: 0 };
        }

        if (shouldSwitch) {
          lastDropTarget.current = dropTarget;
          pendingTargetRef.current = { target: null, frames: 0 };

          setDragState((s) => ({
            ...s,
            dropTargetIndex: dropTarget?.targetIndex ?? null,
            previewColSpan: dropTarget?.previewColSpan ?? null,
            previewLayout,
          }));
        }
      });
    },
    [containerRef, getWidgets, maxColumns, computePreviewLayout, clearLongPressTimer, activateDrag, removeAllListeners]
  );

  const resetDragState = useCallback(() => {
    clearLongPressTimer();
    removeAllListeners();
    activeRef.current = null;
    initialPosRef.current = null;
    pointerRef.current = null;
    lastDropTarget.current = null;
    grabOffsetRef.current = null;
    dragPositionRef.current = null;
    pendingTargetRef.current = { target: null, frames: 0 };
    setDragState(INITIAL_DRAG_STATE);
  }, [clearLongPressTimer, removeAllListeners]);

  const handlePointerUp = useCallback(
    () => {
      const active = activeRef.current;
      if (!active) return;

      clearLongPressTimer();
      removeAllListeners();

      if (active.activated) {
        const dropTarget = lastDropTarget.current;

        if (dropTarget) {
          const widgets = getWidgets();

          // Validate canDrop if provided.
          if (canDropRef.current) {
            if (!canDropRef.current(active.id, dropTarget.targetIndex, getState())) {
              // Drop rejected — reset and bail out.
              activeRef.current = null;
              initialPosRef.current = null;
              pointerRef.current = null;
              lastDropTarget.current = null;
              grabOffsetRef.current = null;
              pendingTargetRef.current = { target: null, frames: 0 };
              setDragState(INITIAL_DRAG_STATE);
              return;
            }
          }
          const visible = widgets
            .filter((w) => w.visible)
            .sort((a, b) => a.order - b.order);
          const fromIndex = visible.findIndex((w) => w.id === active.id);

          if (dropTarget.swapWithId) {
            const draggedWidget = visible.find(
              (w) => w.id === active.id
            );
            const targetWidget = visible.find(
              (w) => w.id === dropTarget.swapWithId
            );
            if (draggedWidget && targetWidget) {
              const updated = widgets.map((w) => {
                if (w.id === active.id)
                  return { ...w, order: targetWidget.order, columnStart: undefined };
                if (w.id === dropTarget.swapWithId)
                  return { ...w, order: draggedWidget.order, columnStart: undefined };
                return w.columnStart != null
                  ? { ...w, columnStart: undefined }
                  : w;
              });
              onBatchUpdate(updated);
            }
          } else {
            const hasResizes = dropTarget.affectedResizes.length > 0;
            const hasColumnStart = dropTarget.columnStart != null;

            if (hasResizes || hasColumnStart) {
              const resizeMap = new Map(
                dropTarget.affectedResizes.map((r) => [r.id, r.colSpan])
              );
              const updated = widgets.map((w) => {
                let result = w;
                if (w.columnStart != null) {
                  result = { ...result, columnStart: undefined };
                }
                const newSpan = resizeMap.get(w.id);
                if (newSpan !== undefined)
                  result = { ...result, colSpan: newSpan };
                if (w.id === active.id && hasColumnStart) {
                  result = { ...result, columnStart: dropTarget.columnStart };
                }
                return result;
              });
              onBatchUpdate(updated);
            }

            if (fromIndex !== -1 && fromIndex !== dropTarget.targetIndex) {
              onReorder(fromIndex, dropTarget.targetIndex);
            }
          }
        }
      }

      activeRef.current = null;
      initialPosRef.current = null;
      pointerRef.current = null;
      lastDropTarget.current = null;
      grabOffsetRef.current = null;
      pendingTargetRef.current = { target: null, frames: 0 };
      setDragState(INITIAL_DRAG_STATE);
    },
    [clearLongPressTimer, removeAllListeners, getWidgets, getState, onReorder, onBatchUpdate]
  );

  const handleAbort = useCallback(() => {
    if (!activeRef.current) return;
    resetDragState();
  }, [resetDragState]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") handleAbort();
    },
    [handleAbort]
  );

  const startDrag = useCallback(
    (
      id: string,
      pointerId: number,
      initialPos: { x: number; y: number },
      element: HTMLElement,
      pointerType?: string
    ) => {
      const pType = pointerType ?? "mouse";
      activeRef.current = { id, pointerId, element, activated: false, pointerType: pType };
      initialPosRef.current = initialPos;
      pointerRef.current = initialPos;

      listenersRef.current = {
        move: handlePointerMove,
        up: handlePointerUp,
        key: handleKeyDown,
        abort: handleAbort,
      };
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("pointercancel", handleAbort);
      document.addEventListener("visibilitychange", handleAbort);

      // Touch: start long-press timer instead of distance-based activation
      if (pType === "touch") {
        setDragState((prev) => ({
          ...prev,
          isLongPressing: true,
          longPressTargetId: id,
        }));

        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          const active = activeRef.current;
          if (active && !active.activated) {
            activateDrag(active);
          }
        }, TOUCH_DRAG_ACTIVATION_DELAY);
      }
    },
    [handlePointerMove, handlePointerUp, handleKeyDown, handleAbort, activateDrag]
  );

  const updateDragPointer = useCallback(
    (pos: { x: number; y: number }) => {
      pointerRef.current = pos;
    },
    []
  );

  const endDrag = useCallback(() => {
    if (!activeRef.current) return;
    resetDragState();
  }, [resetDragState]);

  const getDragPosition = useCallback(
    () => dragPositionRef.current,
    []
  );

  const getPointerPosition = useCallback(
    () => pointerRef.current,
    []
  );

  return { dragState, startDrag, updateDragPointer, endDrag, getDragPosition, getPointerPosition };
}
