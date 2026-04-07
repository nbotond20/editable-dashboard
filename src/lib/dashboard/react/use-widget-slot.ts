import { useCallback, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDashboard } from "../state/use-dashboard.ts";
import type { WidgetState, DragHandleProps, WidgetLayout } from "../types.ts";

export interface UseWidgetSlotResult {
  /** Resolved position — uses preview layout for non-dragged widgets during drag, normal layout otherwise. */
  position: WidgetLayout | undefined;
  /** True if this widget is currently being dragged. */
  isDragging: boolean;
  /** True if any widget (or external item) is being dragged. */
  isAnyDragging: boolean;
  /** True if this widget is being long-pressed (touch). */
  isLongPressing: boolean;
  /** Props to spread on the drag handle element. */
  dragHandleProps: DragHandleProps;
  /** Ref callback — attach to the widget root element for height measurement. */
  measureRef: (node: HTMLElement | null) => void;
  /** Resize this widget to a new colSpan. */
  resize: (colSpan: number) => void;
  /** Remove this widget from the dashboard. */
  remove: () => void;
  /** Get the current drag position (widget top-left in client coords). Null when not dragging. */
  getDragPosition: () => { x: number; y: number } | null;
  /** Current drag phase. */
  phase: string;
}

/**
 * Headless hook that encapsulates widget slot logic — position resolution,
 * drag handle props, measurement, and actions. Zero animation dependency.
 *
 * Consumers use the returned data to drive their own animation layer.
 *
 * @example
 * ```tsx
 * function MyWidgetSlot({ widget }: { widget: WidgetState }) {
 *   const slot = useWidgetSlot(widget);
 *   if (!slot.position) return null;
 *   return (
 *     <div style={{ position: "absolute", left: slot.position.x, top: slot.position.y }}>
 *       <button {...slot.dragHandleProps}>Drag</button>
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWidgetSlot(widget: WidgetState): UseWidgetSlotResult {
  const {
    layout,
    actions,
    dragState,
    getDragPosition,
    measureRef,
    startDrag,
    getA11yProps,
    handleKeyboardDrag,
    isWidgetLockActive,
    doubleClickToMaximize,
    state,
    phase,
  } = useDashboard();

  const isDragging = dragState.activeId === widget.id;
  const isAnyDragging = dragState.activeId !== null || dragState.isExternalDrag;
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

  const mRef = useMemo(() => measureRef(widget.id), [measureRef, widget.id]);

  const resize = useCallback(
    (colSpan: number) => actions.resizeWidget(widget.id, colSpan),
    [actions, widget.id]
  );

  const remove = useCallback(
    () => actions.removeWidget(widget.id),
    [actions, widget.id]
  );

  return {
    position,
    isDragging,
    isAnyDragging,
    isLongPressing: dragState.longPressTargetId === widget.id,
    dragHandleProps,
    measureRef: mRef,
    resize,
    remove,
    getDragPosition,
    phase,
  };
}
