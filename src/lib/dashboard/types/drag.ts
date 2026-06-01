import type { PointerEvent as ReactPointerEvent } from "react";
import type { WidgetState } from "./widget.ts";
import type { ComputedLayout, EmptySlotDragState, WidgetLayout } from "./layout.ts";

/**
 * Why an insertion line (or the slot a dragged widget is hovering) cannot accept the drop.
 *
 * - `position-locked` — the move would cross a position-locked widget.
 * - `only-full-width` — the dragged widget's minimum span equals the column count, so it
 *   cannot share a row and only fits as a full-width row.
 * - `resize-locked` — a stationary widget in the target row is resize-locked and cannot shrink.
 * - `column-overflow` — the widgets cannot be redistributed to fit within the column count.
 */
export type InsertionInvalidReason =
  | "position-locked"
  | "only-full-width"
  | "resize-locked"
  | "column-overflow";

/**
 * The footprint the dragged widget would occupy at the currently-hovered location,
 * together with why the drop is not allowed there.
 *
 * Populated only during a `"lines"`-mode pointer drag when the pointer is over an
 * infeasible insertion location. `rect` is in pixels relative to the grid container's
 * top-left corner. `null` whenever the current location is a valid drop target.
 */
export interface InvalidDropTarget {
  rect: { x: number; y: number; width: number; height: number };
  reason: InsertionInvalidReason;
  /** Orientation of the insertion location that is infeasible. */
  orientation: "horizontal" | "vertical";
  /** Widget the dragged item would land before, or `null` at a row/board edge. */
  beforeId: string | null;
  /** Widget the dragged item would land after, or `null` at a row/board edge. */
  afterId: string | null;
}

/**
 * Current drag interaction state exposed via {@link DashboardContextValue.dragState}.
 */
export interface DragState {
  activeId: string | null;
  dropTargetIndex: number | null;
  previewColSpan: number | null;
  previewLayout: ComputedLayout | null;
  isLongPressing: boolean;
  longPressTargetId: string | null;
  isExternalDrag: boolean;
  externalWidgetType: string | null;
  intentType: "none" | "reorder" | "swap" | "deferred-swap" | "auto-resize" | "column-pin" | "empty-row-maximize" | "new-row" | "in-row-insert" | null;
  /** Widget ID that will be swapped on drop (deferred-swap intent). Null otherwise. */
  swapTargetId: string | null;
  /**
   * Layout of the dragged widget at its original (pre-drag) position.
   *
   * Populated only during a pointer drag while `dropMode` is `"lines"`,
   * giving consumers a headless anchor to render a "source ghost" placeholder at
   * the slot the widget was picked up from. `null` in all other cases.
   */
  sourceGhost: WidgetLayout | null;
  /**
   * The footprint and reason for an infeasible drop at the hovered location.
   *
   * Populated only during a `"lines"`-mode pointer drag while the pointer is over a
   * location the dragged widget cannot fit. Use it to render a "cannot fit" affordance.
   * `null` whenever the current location is a valid drop target.
   */
  invalidTarget: InvalidDropTarget | null;
  /**
   * Live valid/invalid feedback for the empty "add a widget" slot the dragged
   * widget is currently over, or `null` when it is not over one. Mirrors
   * {@link useEmptySlotDragState}.
   */
  emptySlotDragState: EmptySlotDragState | null;
}

/** Resolved drop target information produced by the drag engine. */
export interface DropTarget {
  targetIndex: number;
  previewColSpan: number | null;
  affectedResizes: Array<{ id: string; colSpan: number }>;
  columnStart?: number;
  swapWithId?: string;
}

/** Accessibility attributes for a drag handle element. */
export interface DragHandleA11yProps {
  role: 'button';
  tabIndex: 0;
  'aria-roledescription': 'sortable';
  'aria-label': string;
  'aria-pressed'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Complete props to spread onto a drag handle element.
 */
export interface DragHandleProps extends DragHandleA11yProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  style: { cursor: string; touchAction: string };
}

/** Props passed to a widget slot render function. */
export interface WidgetSlotRenderProps {
  widget: WidgetState;
  dragHandleProps: DragHandleProps;
  isDragging: boolean;
  colSpan: number;
  resize: (colSpan: number) => void;
  remove: () => void;
}

/** Keyboard drag state tracked internally by the provider. */
export interface KeyboardDragState {
  isKeyboardDragging: boolean;
  keyboardDragId: string | null;
  keyboardTargetIndex: number | null;
}
