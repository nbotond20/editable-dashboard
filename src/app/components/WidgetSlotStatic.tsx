import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useDashboard, type WidgetState, type DragHandleProps } from "../../lib/dashboard/index.ts";

interface WidgetSlotStaticProps {
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

export function WidgetSlotStatic({ widget, children }: WidgetSlotStaticProps) {
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

  const elRef = useRef<HTMLDivElement>(null);
  const rafId = useRef(0);
  const positionRef = useRef(position);

  useLayoutEffect(() => {
    cancelAnimationFrame(rafId.current);

    if (isDragging) {
      const tick = () => {
        const dp = getDragPosition();
        const pos = positionRef.current;
        if (dp && pos && elRef.current) {
          elRef.current.style.transform = `translate(${dp.x - pos.x}px, ${dp.y - pos.y}px)`;
        }
        rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
    } else {
      if (elRef.current) elRef.current.style.transform = "";
    }
    return () => cancelAnimationFrame(rafId.current);
  }, [isDragging, getDragPosition]);

  useEffect(() => {
    positionRef.current = position;
  });

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
    measureRef(widget.id)(node);
  }, [measureRef, widget.id]);

  if (!position) return null;

  return (
    <div
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
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.95 : 1,
        boxShadow: isDragging ? "0 20px 40px rgba(0,0,0,0.15)" : undefined,
        scale: isDragging ? "1.03" : undefined,
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
        toggleVisibility,
      })}
    </div>
  );
}
