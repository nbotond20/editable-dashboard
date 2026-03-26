import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, animate } from "motion/react";
import { useDashboard, type WidgetState, type DragHandleProps } from "../../lib/dashboard/index.ts";
import { LAYOUT_SPRING } from "../animation-config.ts";

interface WidgetSlotProps {
  widget: WidgetState;
  children: (
    widget: WidgetState,
    slotProps: {
      key: string;
      widget: WidgetState;
      dragHandleProps: DragHandleProps;
      isDragging: boolean;
      colSpan: number;
      resize: (colSpan: number) => void;
      remove: () => void;
      toggleVisibility: () => void;
    }
  ) => React.ReactNode;
}

export function WidgetSlot({ widget, children }: WidgetSlotProps) {
  const { layout, actions, dragState, getDragPosition, measureRef, startDrag, getA11yProps, handleKeyboardDrag, isWidgetLocked } = useDashboard();

  const isDragging = dragState.activeId === widget.id;
  const isAnyDragging = dragState.activeId !== null;
  const locked = isWidgetLocked(widget.id);

  const previewPos = dragState.previewLayout?.positions.get(widget.id);
  const normalPos = layout.positions.get(widget.id);
  const position = isAnyDragging && !isDragging && previewPos ? previewPos : normalPos;

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (locked) return;
      e.preventDefault();
      startDrag(widget.id, e.pointerId, { x: e.clientX, y: e.clientY }, e.currentTarget as HTMLElement, e.pointerType);
    },
    [widget.id, startDrag, locked]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (locked) return;
      handleKeyboardDrag(widget.id, e);
    },
    [widget.id, handleKeyboardDrag, locked]
  );

  const a11yProps = getA11yProps(widget.id);

  const dragHandleProps: DragHandleProps = {
    ...a11yProps,
    onPointerDown: handlePointerDown,
    onKeyDown: handleKeyDown,
    style: { cursor: locked ? "default" : isDragging ? "grabbing" : "grab", touchAction: "none" },
  };

  const resize = useCallback(
    (colSpan: number) => actions.resizeWidget(widget.id, colSpan),
    [actions, widget.id]
  );

  const remove = useCallback(
    () => actions.removeWidget(widget.id),
    [actions, widget.id]
  );

  const toggleVisibility = useCallback(
    () => actions.toggleVisibility(widget.id),
    [actions, widget.id]
  );

  const motionX = useMotionValue(0);
  const motionY = useMotionValue(0);
  const rafId = useRef(0);
  const positionRef = useRef(position);
  useEffect(() => { positionRef.current = position; });

  // Drag position follow loop.
  // getDragPosition reads the engine directly (not React state), so it
  // always returns the latest pointer position without waiting for a
  // re-render. We also check getDragPosition() inside the loop instead
  // of gating on isDragging — this way the loop starts immediately on
  // the first pointerdown→activate, not after React re-renders.
  useEffect(() => {
    if (!isDragging) {
      cancelAnimationFrame(rafId.current);
      animate(motionX, 0, LAYOUT_SPRING);
      animate(motionY, 0, LAYOUT_SPRING);
      return;
    }

    const tick = () => {
      const dp = getDragPosition();
      const pos = positionRef.current;
      if (dp && pos) {
        motionX.set(dp.x - pos.x);
        motionY.set(dp.y - pos.y);
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [isDragging, getDragPosition, motionX, motionY]);

  if (!position) return null;

  return (
    <motion.div
      layout
      layoutId={widget.id}
      ref={measureRef(widget.id)}
      data-widget-id={widget.id}
      data-widget-order={widget.order}
      data-colspan={widget.colSpan}
      data-x={position.x}
      data-y={position.y}
      data-width={position.width}
      data-height={position.height}
      data-dragging={isDragging}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: position.width,
        x: motionX,
        y: motionY,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: isDragging ? 1.03 : 1,
        zIndex: isDragging ? 50 : 1,
        boxShadow: isDragging
          ? "0 20px 40px rgba(0,0,0,0.15)"
          : "0 0px 0px rgba(0,0,0,0)",
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={LAYOUT_SPRING}
    >
      {children(widget, {
        key: widget.id,
        widget,
        dragHandleProps,
        isDragging,
        colSpan: widget.colSpan,
        resize,
        remove,
        toggleVisibility,
      })}
    </motion.div>
  );
}
