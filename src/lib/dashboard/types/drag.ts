import type { PointerEvent as ReactPointerEvent } from "react";
import type { WidgetState } from "./widget.ts";
import type { ComputedLayout, WidgetLayout } from "./layout.ts";

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
