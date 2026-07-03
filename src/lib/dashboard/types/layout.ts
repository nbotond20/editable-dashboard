import type { InsertionInvalidReason } from "./drag.ts";

/**
 * Computed position and size of a single widget in the layout.
 *
 * All values are in pixels relative to the grid container's top-left corner.
 */
export interface WidgetLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colSpan: number;
}

/**
 * The result of running the layout algorithm.
 */
export interface ComputedLayout {
  positions: Map<string, WidgetLayout>;
  totalHeight: number;
}

/**
 * A region of free column space in the layout where a new widget could be added.
 *
 * Produced by `useEmptySlots()`. Covers every free-column run in each row —
 * leading, interior and trailing — and an empty dashboard. Vertically contiguous
 * runs in the same columns are merged into a single slot, so a free column that
 * spans several stacked rows is reported once. All values are in pixels relative
 * to the grid container's top-left corner.
 */
export interface EmptySlot {
  /** Row index of the slot's top edge (0-based, top to bottom). */
  rowIndex: number;
  /** First free column index within the row. */
  columnStart: number;
  /** Number of free columns the slot spans. */
  colSpan: number;
  /** Widget immediately to the left of the free space. `null` at the row's left edge. */
  beforeId: string | null;
  /** Widget immediately to the right of the free space. `null` at the row's right edge. */
  afterId: string | null;
  /**
   * Primary neighbouring widget the slot hangs off (`beforeId ?? afterId`), used
   * for reflow-follow. `null` only for the empty-board slot.
   */
  anchorId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Live drop feedback for the empty slot a dragged widget is currently over.
 *
 * Produced by `useEmptySlotDragState()` during a `"lines"`-mode pointer drag.
 * `null` when no slot is the current target. Identify the slot via
 * `rowIndex` + `columnStart`, then render `state` (and `reason` when invalid).
 */
export interface EmptySlotDragState {
  rowIndex: number;
  columnStart: number;
  state: "valid" | "invalid";
  reason?: InsertionInvalidReason;
}
