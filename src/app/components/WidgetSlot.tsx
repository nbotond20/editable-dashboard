import { motion } from "motion/react";
import { useWidgetSlot, useDragFollow, type WidgetState, type DragHandleProps } from "../../lib/dashboard/index.ts";
import { SPRINGS, SETTLE_EASING, SETTLE_DURATION } from "../animation-config.ts";

interface WidgetSlotProps {
  widget: WidgetState;
  animated?: boolean;
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
      isLongPressing: boolean;
    }
  ) => React.ReactNode;
}

export function WidgetSlot({ widget, animated = true, children }: WidgetSlotProps) {
  const slot = useWidgetSlot(widget);
  const { ref: dragRef, isActive: dragActive } = useDragFollow(slot, {
    settle: animated
      ? { duration: SETTLE_DURATION, easing: SETTLE_EASING }
      : false,
  });

  if (!slot.position) return null;

  const { position, isDragging } = slot;

  return (
    <motion.div
      layout={animated && !dragActive ? "position" : false}
      ref={dragRef}
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
        zIndex: dragActive ? 50 : 1,
        ...(!animated && isDragging ? {
          opacity: 0.95,
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
          scale: "1.03",
        } : {}),
      }}
      initial={false}
      animate={animated ? {
        opacity: 1,
        scale: isDragging ? 1.03 : 1,
        boxShadow: isDragging
          ? "0 20px 40px rgba(0,0,0,0.15)"
          : "0 0px 0px rgba(0,0,0,0)",
      } : undefined}
      exit={animated ? { opacity: 0, scale: 0.95 } : undefined}
      transition={animated ? {
        ...SPRINGS.layout,
      } : { duration: 0 }}
    >
      {children(widget, {
        key: widget.id,
        widget,
        dragHandleProps: slot.dragHandleProps,
        isDragging,
        colSpan: widget.colSpan,
        resize: slot.resize,
        remove: slot.remove,
        isLongPressing: slot.isLongPressing,
      })}
    </motion.div>
  );
}
