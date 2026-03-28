import type { Point, DropZone } from "./types.ts";
import type { ComputedLayout, WidgetState } from "../types.ts";

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

  const visible = widgets
    .filter((w) => w.visible && w.id !== sourceId)
    .sort((a, b) => a.order - b.order);

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

  const inset = gap / 2;

  for (const r of resolved) {
    const ix = r.x + inset;
    const iy = r.y + inset;
    const iw = r.width - gap;
    const ih = r.height - gap;

    if (iw > 0 && ih > 0) {
      if (
        pointer.x >= ix &&
        pointer.x < ix + iw &&
        pointer.y >= iy &&
        pointer.y < iy + ih
      ) {
        const centerX = r.x + r.width / 2;
        const side = pointer.x < centerX ? "left" : "right";
        return { type: "widget", targetId: r.id, side };
      }
    }
  }

  if (resolved.length > 0) {
    const first = resolved[0];
    if (isInGapBefore(pointer, first, inset)) {
      return {
        type: "gap",
        beforeId: null,
        afterId: first.id,
        index: 0,
      };
    }

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
  }

  if (pointer.x >= 0 && pointer.x < containerWidth && pointer.y >= 0) {
    const colBottoms = new Array(maxColumns).fill(0);
    for (const [, pos] of layout.positions) {
      const startCol = Math.round(pos.x / (colWidth + gap));
      const span = Math.max(
        1,
        Math.round((pos.width + gap) / (colWidth + gap))
      );
      for (
        let c = startCol;
        c < Math.min(startCol + span, maxColumns);
        c++
      ) {
        colBottoms[c] = Math.max(colBottoms[c], pos.y + pos.height);
      }
    }

    const col = Math.min(
      Math.max(0, Math.floor(pointer.x / (colWidth + gap))),
      maxColumns - 1
    );

    if (colBottoms[col] > 0 && pointer.y >= colBottoms[col] && pointer.y < layout.totalHeight) {
      return { type: "empty", column: col };
    }

    if (colBottoms[col] > 0 && pointer.y < colBottoms[col]) {
      const overlaps = Array.from(layout.positions.values()).some((r) => {
        const rCol = Math.round(r.x / (colWidth + gap));
        const rSpan = Math.max(1, Math.round((r.width + gap) / (colWidth + gap)));
        return (
          col >= rCol &&
          col < rCol + rSpan &&
          pointer.y >= r.y &&
          pointer.y < r.y + r.height
        );
      });
      if (!overlaps) {
        return { type: "empty", column: col };
      }
    }
  }

  if (resolved.length > 0) {
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

  if (pointer.y >= layout.totalHeight && pointer.x >= 0 && pointer.x < containerWidth) {
    const column = Math.min(
      Math.floor(pointer.x / (colWidth + gap)),
      maxColumns - 1
    );
    return { type: "empty", column: Math.max(0, column) };
  }

  return { type: "outside" };
}

function isInGapBefore(
  pointer: Point,
  first: { x: number; y: number; width: number; height: number },
  inset: number
): boolean {
  const insetX = first.x + inset;
  const insetY = first.y + inset;

  if (pointer.y < 0 || pointer.y >= first.y + first.height) return false;

  if (insetX > 0) {
    if (pointer.x >= 0 && pointer.x < insetX) return true;
  }

  if (insetY > 0 && pointer.y >= 0 && pointer.y < insetY) {
    if (pointer.x >= first.x && pointer.x < first.x + first.width) return true;
  }

  return false;
}

function isInGapBetween(
  pointer: Point,
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  inset: number,
  containerWidth: number
): boolean {
  const aBottom = a.y + a.height;
  const bBottom = b.y + b.height;

  const aInsetRight = a.x + a.width - inset;
  const bInsetLeft = b.x + inset;

  const sameRow = a.y < bBottom && b.y < aBottom;
  if (sameRow && bInsetLeft > aInsetRight) {
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

  if (b.y >= aBottom) {
    const aInsetBottom = aBottom - inset;
    const bInsetTop = b.y + inset;

    if (bInsetTop > aInsetBottom) {
      const inWidgetARange = pointer.x >= a.x && pointer.x < a.x + a.width;
      const inWidgetBRange = pointer.x >= b.x && pointer.x < b.x + b.width;
      if (
        (inWidgetARange || inWidgetBRange) &&
        pointer.y >= aInsetBottom &&
        pointer.y < bInsetTop
      ) {
        return true;
      }
    }

    const aRight = a.x + a.width;
    if (aRight < containerWidth) {
      // When the next widget wraps to a new row starting at or before
      // the current widget's column, the gap extends to the container edge.
      const gapRight = (b.x <= a.x) ? containerWidth : aRight + inset;
      if (
        pointer.x >= aInsetRight &&
        pointer.x < gapRight &&
        pointer.y >= a.y &&
        pointer.y < aBottom
      ) {
        return true;
      }
    }

    if (b.x > 0) {
      const gapLeft = Math.max(0, b.x - inset);
      if (
        pointer.x >= gapLeft &&
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

  if (lastInsetBottom < totalHeight) {
    if (
      pointer.y >= lastInsetBottom &&
      pointer.y < totalHeight &&
      pointer.x >= last.x &&
      pointer.x < lastRight
    ) {
      return true;
    }
  }

  return false;
}
