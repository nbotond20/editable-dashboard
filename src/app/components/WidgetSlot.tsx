import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import { useDashboard, type WidgetState, type DragHandleProps } from "../../lib/dashboard/index.ts";
import { LAYOUT_SPRING } from "../animation-config.ts";

function springStep(current: number, target: number, velocity: number, dt: number) {
  const { stiffness, damping, mass } = LAYOUT_SPRING;
  const springForce = -stiffness * (current - target);
  const dampingForce = -damping * velocity;
  const acceleration = (springForce + dampingForce) / mass;
  const newVelocity = velocity + acceleration * dt;
  const newValue = current + newVelocity * dt;
  return { value: newValue, velocity: newVelocity };
}

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
      isLongPressing: boolean;
    }
  ) => React.ReactNode;
}

export function WidgetSlot({ widget, children }: WidgetSlotProps) {
  const { layout, actions, dragState, getDragPosition, measureRef, startDrag, getA11yProps, handleKeyboardDrag, isWidgetLockActive, doubleClickToMaximize, state } = useDashboard();

  const isDragging = dragState.activeId === widget.id;
  const isAnyDragging = dragState.activeId !== null;
  const locked = isWidgetLockActive(widget.id, "position");

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

  const a11yProps = useMemo(() => getA11yProps(widget.id), [getA11yProps, widget.id]);

  const [preMaximizeColSpan, setPreMaximizeColSpan] = useState<number | null>(null);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (locked) return;
      e.preventDefault();
      const maxColumns = state.maxColumns;
      if (widget.colSpan >= maxColumns && preMaximizeColSpan !== null) {
        actions.resizeWidget(widget.id, preMaximizeColSpan);
        setPreMaximizeColSpan(null);
      } else if (widget.colSpan < maxColumns) {
        setPreMaximizeColSpan(widget.colSpan);
        actions.resizeWidget(widget.id, maxColumns);
      }
    },
    [locked, state.maxColumns, widget.colSpan, widget.id, preMaximizeColSpan, actions]
  );

  const dragHandleProps: DragHandleProps = useMemo(() => ({
    ...a11yProps,
    onPointerDown: handlePointerDown,
    onKeyDown: handleKeyDown,
    onDoubleClick: doubleClickToMaximize ? handleDoubleClick : undefined,
    style: { cursor: locked ? "default" : isDragging ? "grabbing" : "grab", touchAction: "none" },
  }), [a11yProps, handlePointerDown, handleKeyDown, handleDoubleClick, doubleClickToMaximize, locked, isDragging]);

  const resize = useCallback(
    (colSpan: number) => actions.resizeWidget(widget.id, colSpan),
    [actions, widget.id]
  );

  const remove = useCallback(
    () => actions.removeWidget(widget.id),
    [actions, widget.id]
  );

  const elRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafId = useRef(0);
  const positionRef = useRef(position);

  const [prevIsDragging, setPrevIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null);
  const [flipTarget, setFlipTarget] = useState<{ originX: number; originY: number; posX: number; posY: number } | null>(null);

  if (isDragging && !prevIsDragging && position) {
    setPrevIsDragging(true);
    setDragOrigin({ x: position.x, y: position.y });
  } else if (!isDragging && prevIsDragging) {
    setPrevIsDragging(false);
    setIsSettling(true);
    if (dragOrigin && position) {
      setFlipTarget({ originX: dragOrigin.x, originY: dragOrigin.y, posX: position.x, posY: position.y });
    }
  }

  const consumedFlipRef = useRef<typeof flipTarget>(null);

  useLayoutEffect(() => {
    cancelAnimationFrame(rafId.current);

    if (flipTarget && flipTarget !== consumedFlipRef.current) {
      consumedFlipRef.current = flipTarget;
      const visualX = flipTarget.originX + offsetRef.current.x;
      const visualY = flipTarget.originY + offsetRef.current.y;
      offsetRef.current = { x: visualX - flipTarget.posX, y: visualY - flipTarget.posY };
      if (elRef.current) {
        elRef.current.style.translate = `${offsetRef.current.x}px ${offsetRef.current.y}px`;
      }
    }

    if (isDragging) {
      const tick = () => {
        const dp = getDragPosition();
        const pos = positionRef.current;
        if (dp && pos && elRef.current) {
          offsetRef.current = { x: dp.x - pos.x, y: dp.y - pos.y };
          elRef.current.style.translate = `${offsetRef.current.x}px ${offsetRef.current.y}px`;
        }
        rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
    } else if (isSettling) {
      let vx = 0, vy = 0;
      let prev = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - prev) / 1000, 0.032);
        prev = now;
        const sx = springStep(offsetRef.current.x, 0, vx, dt);
        const sy = springStep(offsetRef.current.y, 0, vy, dt);
        offsetRef.current = { x: sx.value, y: sy.value };
        vx = sx.velocity;
        vy = sy.velocity;
        if (elRef.current) {
          elRef.current.style.translate = `${sx.value}px ${sy.value}px`;
        }
        if (Math.abs(sx.value) < 0.5 && Math.abs(sy.value) < 0.5 &&
            Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
          offsetRef.current = { x: 0, y: 0 };
          if (elRef.current) elRef.current.style.translate = "";
          setIsSettling(false);
          setDragOrigin(null);
          return;
        }
        rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
    } else {
      offsetRef.current = { x: 0, y: 0 };
      if (elRef.current) elRef.current.style.translate = "";
    }
    return () => cancelAnimationFrame(rafId.current);
  }, [isDragging, isSettling, getDragPosition, flipTarget]);

  useEffect(() => {
    positionRef.current = position;
  });

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
    measureRef(widget.id)(node);
  }, [measureRef, widget.id]);

  if (!position) return null;

  return (
    <motion.div
      layout={!isDragging && !isSettling ? "position" : false}
      ref={combinedRef}
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
        zIndex: isDragging || isSettling ? 50 : 1,
      }}
      initial={false}
      animate={{
        opacity: 1,
        scale: isDragging ? 1.03 : 1,
        width: position.width,
        boxShadow: isDragging
          ? "0 20px 40px rgba(0,0,0,0.15)"
          : "0 0px 0px rgba(0,0,0,0)",
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        ...LAYOUT_SPRING,
        width: { type: "spring", stiffness: 500, damping: 35, mass: 0.5 },
      }}
    >
      {children(widget, {
        key: widget.id,
        widget,
        dragHandleProps,
        isDragging,
        colSpan: widget.colSpan,
        resize,
        remove,
        isLongPressing: dragState.longPressTargetId === widget.id,
      })}
    </motion.div>
  );
}
