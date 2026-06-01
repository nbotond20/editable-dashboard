import { useRef, useLayoutEffect, useMemo } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import {
  useWidgetSlot,
  useDragFollow,
  useAnchoredInsertionSegments,
  useDashboardDrag,
  type WidgetState,
  type DragHandleProps,
} from "../../lib/dashboard/index.ts";
import { SPRINGS, SETTLE_EASING, SETTLE_DURATION } from "../animation-config.ts";
import { AnchoredInsertionSegment } from "./InsertionLineElement.tsx";

const WIDTH_SPRING = { stiffness: SPRINGS.layout.stiffness, damping: SPRINGS.layout.damping, mass: SPRINGS.layout.mass };

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
  const anchored = useAnchoredInsertionSegments(widget.id);
  const { dragState } = useDashboardDrag();
  const isSwapHighlight = dragState.swapTargetId === widget.id;

  const dragTargetSize = slot.isDragging
    ? dragState.previewLayout?.positions.get(widget.id)
    : undefined;
  const widthTarget = dragTargetSize?.width ?? slot.position?.width ?? 0;
  const morphing = slot.isDragging && dragTargetSize != null;
  const { ref: dragRef, isActive: dragActive } = useDragFollow(slot, {
    settle: animated
      ? { duration: SETTLE_DURATION, easing: SETTLE_EASING }
      : false,
  });

  const anchoredSegments = useMemo(() => {
    if (slot.isDragging || anchored.length === 0) return [];
    const out = new Array(anchored.length);
    for (let i = 0; i < anchored.length; i++) {
      const a = anchored[i];
      out[i] = {
        key: `${a.line.id}:${a.segment.edge}:${a.index}`,
        line: a.line,
        segment: a.segment,
      };
    }
    return out;
  }, [anchored, slot.isDragging]);

  const widthMV = useMotionValue(slot.position?.width ?? 0);
  const springWidth = useSpring(widthMV, WIDTH_SPRING);
  const prevColSpanRef = useRef(slot.position?.colSpan);
  const prevWidthRef = useRef(slot.position?.width);
  const prevXRef = useRef(slot.position?.x);
  const prevYRef = useRef(slot.position?.y);

  useLayoutEffect(() => {
    if (!slot.position) return;
    const isInitial = prevWidthRef.current == null;
    const widthChanged = widthTarget !== prevWidthRef.current;
    const colSpanChanged = slot.position.colSpan !== prevColSpanRef.current;
    const moved = slot.position.x !== prevXRef.current || slot.position.y !== prevYRef.current;

    if (isInitial || widthChanged || colSpanChanged) {
      widthMV.set(widthTarget);
      if (isInitial || (!colSpanChanged && !morphing) || moved) {
        springWidth.jump(widthTarget);
      }
    }

    prevWidthRef.current = widthTarget;
    prevColSpanRef.current = slot.position.colSpan;
    prevXRef.current = slot.position.x;
    prevYRef.current = slot.position.y;
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
      data-swap-target={isSwapHighlight || undefined}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: animated ? springWidth : widthTarget,
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
      <AnimatePresence>
        {isSwapHighlight && (
          <motion.div
            key="swap-overlay"
            data-testid="swap-overlay"
            initial={animated ? { opacity: 0 } : false}
            animate={animated ? { opacity: 1 } : undefined}
            exit={animated ? { opacity: 0 } : undefined}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              background: "rgba(59, 130, 246, 0.32)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {anchoredSegments.map(({ key, line, segment }) => (
          <AnchoredInsertionSegment
            key={key}
            line={line}
            segment={segment}
            widgetX={position.x}
            widgetY={position.y}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
