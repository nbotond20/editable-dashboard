import type { Point, DropZone } from "./types.ts";
import type { ComputedLayout, WidgetState } from "../types.ts";

/**
 * A pure spatial hit-testing function that maps a pointer position
 * to exactly one DropZone. Deterministic -- no scoring, no heuristics.
 */
export function resolveZone(
  pointer: Point,
  layout: ComputedLayout,
  widgets: WidgetState[],
  gap: number,
  maxColumns: number,
  containerWidth: number,
  sourceId: string
): DropZone {
  const colWidth =
    maxColumns > 1
      ? (containerWidth - gap * (maxColumns - 1)) / maxColumns
      : containerWidth;

  // Visible widgets sorted by order, excluding the source widget.
  const visible = widgets
    .filter((w) => w.visible && w.id !== sourceId)
    .sort((a, b) => a.order - b.order);

  // Collect resolved layouts for visible (non-source) widgets.
  const resolved: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  for (const w of visible) {
    const wl = layout.positions.get(w.id);
    if (wl) {
      resolved.push({
        id: wl.id,
        x: wl.x,
        y: wl.y,
        width: wl.width,
        height: wl.height,
      });
    }
  }

  // ── Step 3: hit-test against inset widget bodies ──────────────
  const inset = gap / 2;

  for (const r of resolved) {
    const ix = r.x + inset;
    const iy = r.y + inset;
    const iw = r.width - gap; // inset removes gap/2 from each side
    const ih = r.height - gap;

    if (iw > 0 && ih > 0) {
      if (
        pointer.x >= ix &&
        pointer.x < ix + iw &&
        pointer.y >= iy &&
        pointer.y < iy + ih
      ) {
        return { type: "widget", targetId: r.id };
      }
    }
  }

  // ── Step 4: hit-test against gap regions ──────────────────────
  // We check whether the pointer falls in a gap *between* two adjacent
  // widgets (by visual order). This covers both horizontal gaps (same row)
  // and vertical gaps (between rows).
  //
  // Gap zones extend from inset-boundary to inset-boundary so that
  // the margin area (gap/2 strip around each widget) is reachable as
  // a gap even between tightly packed widgets.

  if (resolved.length > 0) {
    // Check gap before first widget (index 0)
    const first = resolved[0];
    if (isInGapBefore(pointer, first, inset)) {
      return {
        type: "gap",
        beforeId: null,
        afterId: first.id,
        index: 0,
      };
    }

    // Check gaps between adjacent widgets
    for (let i = 0; i < resolved.length - 1; i++) {
      const current = resolved[i];
      const next = resolved[i + 1];

      if (isInGapBetween(pointer, current, next, inset, containerWidth)) {
        return {
          type: "gap",
          beforeId: current.id,
          afterId: next.id,
          index: i + 1,
        };
      }
    }

    // Check gap after last widget
    const last = resolved[resolved.length - 1];
    if (isInGapAfter(pointer, last, inset, layout.totalHeight, containerWidth)) {
      return {
        type: "gap",
        beforeId: last.id,
        afterId: null,
        index: resolved.length,
      };
    }
  }

  // ── Step 5: pointer below all widgets → empty zone ────────────
  if (pointer.y >= layout.totalHeight && pointer.x >= 0 && pointer.x < containerWidth) {
    const column = Math.min(
      Math.floor(pointer.x / (colWidth + gap)),
      maxColumns - 1
    );
    return { type: "empty", column: Math.max(0, column) };
  }

  // ── Step 6: fallback → outside ────────────────────────────────
  return { type: "outside" };
}

// ─── Gap geometry helpers ──────────────────────────────────────────
//
// All helpers receive `inset` (= gap/2). Gap regions are measured from
// inset-boundaries so the margin strip around each widget is reachable.

/**
 * Is the pointer in the gap region *before* the first widget?
 * Covers the area to the left of or above the first widget's inset rect.
 */
function isInGapBefore(
  pointer: Point,
  first: { x: number; y: number; width: number; height: number },
  inset: number
): boolean {
  const insetX = first.x + inset;
  const insetY = first.y + inset;

  // Vertical bound: from top of layout to bottom of first widget rect
  if (pointer.y < 0 || pointer.y >= first.y + first.height) return false;

  // Horizontal: pointer to the left of the first widget's inset left edge
  if (insetX > 0) {
    if (pointer.x >= 0 && pointer.x < insetX) return true;
  }

  // Top: pointer above the first widget's inset top edge, within its x range
  if (insetY > 0 && pointer.y >= 0 && pointer.y < insetY) {
    if (pointer.x >= first.x && pointer.x < first.x + first.width) return true;
  }

  return false;
}

/**
 * Is the pointer in the gap region between two adjacent widgets?
 *
 * Gap extends from inset-boundary of `a` to inset-boundary of `b`.
 * Two cases:
 * 1. Horizontal gap: widgets on the same row
 * 2. Vertical gap / row wrap: widgets on different rows
 */
function isInGapBetween(
  pointer: Point,
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  inset: number,
  containerWidth: number
): boolean {
  const aBottom = a.y + a.height;
  const bBottom = b.y + b.height;

  // Inset boundaries
  const aInsetRight = a.x + a.width - inset;
  const bInsetLeft = b.x + inset;

  // Case 1: Same row (overlapping vertical extent)
  const sameRow = a.y < bBottom && b.y < aBottom;
  if (sameRow && bInsetLeft > aInsetRight) {
    // Horizontal gap band between the two inset boundaries
    const gapTop = Math.min(a.y, b.y);
    const gapBottom = Math.max(aBottom, bBottom);

    if (
      pointer.x >= aInsetRight &&
      pointer.x < bInsetLeft &&
      pointer.y >= gapTop &&
      pointer.y < gapBottom
    ) {
      return true;
    }
  }

  // Case 2: Different rows (b starts at or below a's bottom)
  if (b.y >= aBottom) {
    const aInsetBottom = aBottom - inset;
    const bInsetTop = b.y + inset;

    // Vertical gap band between inset-bottom of a and inset-top of b
    if (bInsetTop > aInsetBottom) {
      if (
        pointer.y >= aInsetBottom &&
        pointer.y < bInsetTop &&
        pointer.x >= 0 &&
        pointer.x < containerWidth
      ) {
        return true;
      }
    }

    // Area to the right of `a` on its row (a wraps, gap before b)
    const aRight = a.x + a.width;
    if (aRight < containerWidth) {
      if (
        pointer.x >= aInsetRight &&
        pointer.x < containerWidth &&
        pointer.y >= a.y &&
        pointer.y < aBottom
      ) {
        return true;
      }
    }

    // Area to the left of `b` on its row
    if (b.x > 0) {
      if (
        pointer.x >= 0 &&
        pointer.x < bInsetLeft &&
        pointer.y >= b.y &&
        pointer.y < bBottom
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Is the pointer in the gap region *after* the last widget?
 * Covers the area to the right of the last widget's inset boundary on
 * its row, and the vertical space below its inset bottom to totalHeight.
 */
function isInGapAfter(
  pointer: Point,
  last: { x: number; y: number; width: number; height: number },
  inset: number,
  totalHeight: number,
  containerWidth: number
): boolean {
  const lastRight = last.x + last.width;
  const lastBottom = last.y + last.height;
  const lastInsetRight = lastRight - inset;
  const lastInsetBottom = lastBottom - inset;

  // Area to the right of last widget's inset-right on its row
  if (lastInsetRight < containerWidth) {
    if (
      pointer.x >= lastInsetRight &&
      pointer.x < containerWidth &&
      pointer.y >= last.y &&
      pointer.y < lastBottom
    ) {
      return true;
    }
  }

  // Vertical gap between last widget's inset-bottom and totalHeight
  if (lastInsetBottom < totalHeight) {
    if (
      pointer.y >= lastInsetBottom &&
      pointer.y < totalHeight &&
      pointer.x >= 0 &&
      pointer.x < containerWidth
    ) {
      return true;
    }
  }

  return false;
}
