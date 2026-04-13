import type { Point, DropZone } from "./types.ts";
import type { ComputedLayout, WidgetState } from "../types.ts";

type WidgetRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function resolveZone(
  pointer: Point,
  layout: ComputedLayout,
  widgets: WidgetState[],
  gap: number,
  maxColumns: number,
  containerWidth: number,
  sourceId: string | null,
  currentWidgetSide?: "left" | "right",
): DropZone {
  const colWidth =
    maxColumns > 1
      ? (containerWidth - gap * (maxColumns - 1)) / maxColumns
      : containerWidth;

  const rects = buildRects(layout, widgets, sourceId);
  const inset = gap / 2;

  const widgetHit = resolveWidgetHit(
    pointer,
    rects,
    inset,
    colWidth,
    currentWidgetSide,
  );
  if (widgetHit) return widgetHit;

  if (rects.length > 0) {
    const first = rects[0];
    if (isInGapBefore(pointer, first, inset)) {
      return { type: "gap", beforeId: null, afterId: first.id, index: 0 };
    }
  }

  for (let i = 0; i < rects.length - 1; i++) {
    const current = rects[i];
    const next = rects[i + 1];
    if (isInGapBetween(pointer, current, next, inset, containerWidth)) {
      return {
        type: "gap",
        beforeId: current.id,
        afterId: next.id,
        index: i + 1,
      };
    }
  }

  if (rects.length > 0) {
    const first = rects[0];
    if (
      pointer.y >= 0 &&
      pointer.y < first.y &&
      pointer.x >= first.x &&
      pointer.x < first.x + first.width &&
      !Array.from(layout.positions.values()).some(pos => pointer.y >= pos.y)
    ) {
      return { type: "gap", beforeId: null, afterId: first.id, index: 0 };
    }
  }

  const emptyZone = resolveEmptyZone(
    pointer,
    layout,
    colWidth,
    gap,
    maxColumns,
    containerWidth,
  );
  if (emptyZone) return emptyZone;

  if (rects.length > 0) {
    const last = rects[rects.length - 1];
    if (isInGapAfter(pointer, last, inset, layout.totalHeight, containerWidth)) {
      return {
        type: "gap",
        beforeId: last.id,
        afterId: null,
        index: rects.length,
      };
    }
  }

  if (
    pointer.y >= layout.totalHeight &&
    pointer.x >= 0 &&
    pointer.x < containerWidth
  ) {
    const column = Math.min(
      Math.floor(pointer.x / (colWidth + gap)),
      maxColumns - 1,
    );
    return { type: "empty", column: Math.max(0, column) };
  }

  if (
    maxColumns > 1 &&
    rects.length > 0 &&
    pointer.x >= containerWidth &&
    pointer.x < containerWidth + gap
  ) {
    const last = rects[rects.length - 1];
    if (pointer.y >= last.y && pointer.y < last.y + last.height) {
      return {
        type: "gap",
        beforeId: last.id,
        afterId: null,
        index: rects.length,
      };
    }
  }

  return { type: "outside" };
}

function buildRects(
  layout: ComputedLayout,
  widgets: WidgetState[],
  sourceId: string | null,
): WidgetRect[] {
  const visible = widgets
    .filter((w) => w.visible && (sourceId == null || w.id !== sourceId))
    .sort((a, b) => a.order - b.order);

  const rects: WidgetRect[] = [];
  for (const w of visible) {
    const wl = layout.positions.get(w.id);
    if (wl) {
      rects.push({
        id: wl.id,
        x: wl.x,
        y: wl.y,
        width: wl.width,
        height: wl.height,
      });
    }
  }
  return rects;
}

function resolveWidgetHit(
  pointer: Point,
  rects: WidgetRect[],
  inset: number,
  colWidth: number,
  currentWidgetSide?: "left" | "right",
): DropZone | null {
  for (const r of rects) {
    const ix = r.x + inset;
    const iy = r.y + inset;
    const iw = r.width - inset * 2;
    const ih = r.height - inset * 2;

    if (iw <= 0 || ih <= 0) continue;

    const insideInset =
      pointer.x >= ix &&
      pointer.x < ix + iw &&
      pointer.y >= iy &&
      pointer.y < iy + ih;

    if (!insideInset) continue;

    const centerX = r.x + r.width / 2;
    const margin = colWidth * 0.1;

    let side: "left" | "right";
    if (currentWidgetSide === "left") {
      side = pointer.x > centerX + margin ? "right" : "left";
    } else if (currentWidgetSide === "right") {
      side = pointer.x < centerX - margin ? "left" : "right";
    } else {
      side = pointer.x < centerX ? "left" : "right";
    }

    return { type: "widget", targetId: r.id, side };
  }

  return null;
}

function resolveEmptyZone(
  pointer: Point,
  layout: ComputedLayout,
  colWidth: number,
  gap: number,
  maxColumns: number,
  containerWidth: number,
): DropZone | null {
  if (pointer.x < 0 || pointer.x >= containerWidth || pointer.y < 0) {
    return null;
  }

  const colBottoms = new Array(maxColumns).fill(0);
  for (const [, pos] of layout.positions) {
    const startCol = Math.round(pos.x / (colWidth + gap));
    const span = Math.max(
      1,
      Math.round((pos.width + gap) / (colWidth + gap)),
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
    maxColumns - 1,
  );

  if (
    colBottoms[col] > 0 &&
    pointer.y >= colBottoms[col] &&
    pointer.y < layout.totalHeight
  ) {
    return { type: "empty", column: col };
  }

  if (colBottoms[col] > 0 && pointer.y < colBottoms[col]) {
    const overlaps = Array.from(layout.positions.values()).some((r) => {
      const rCol = Math.round(r.x / (colWidth + gap));
      const rSpan = Math.max(
        1,
        Math.round((r.width + gap) / (colWidth + gap)),
      );
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

  if (colBottoms[col] === 0 && pointer.y < layout.totalHeight) {
    return { type: "empty", column: col };
  }

  return null;
}

function isInGapBefore(
  pointer: Point,
  first: WidgetRect,
  inset: number,
): boolean {
  const insetX = first.x + inset;
  const insetY = first.y + inset;

  if (pointer.y < 0 || pointer.y >= first.y + first.height) return false;

  if (insetX > 0 && pointer.y >= first.y && pointer.y < first.y + first.height) {
    if (pointer.x >= 0 && pointer.x < insetX) return true;
  }

  if (insetY > 0 && pointer.y >= Math.max(0, first.y - inset) && pointer.y < insetY) {
    if (pointer.x >= first.x && pointer.x < first.x + first.width) return true;
  }

  return false;
}

function isInGapBetween(
  pointer: Point,
  a: WidgetRect,
  b: WidgetRect,
  inset: number,
  containerWidth: number,
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
      const gapRight = b.x <= a.x ? containerWidth : aRight + inset;
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
  last: WidgetRect,
  inset: number,
  totalHeight: number,
  containerWidth: number,
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
