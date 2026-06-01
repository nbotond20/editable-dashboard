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
 * Produced by `useEmptySlots()`. Covers trailing free columns in partially-filled
 * rows and an empty dashboard. All values are in pixels relative to the grid
 * container's top-left corner.
 */
export interface EmptySlot {
  /** Row index this slot belongs to (0-based, top to bottom). */
  rowIndex: number;
  /** First free column index within the row. */
  columnStart: number;
  /** Number of free columns the slot spans. */
  colSpan: number;
  /** Rightmost widget in the row, before the free space. `null` for the empty-board slot. */
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
