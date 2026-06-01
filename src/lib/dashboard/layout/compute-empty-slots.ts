import type { ComputedLayout, EmptySlot, WidgetLayout, WidgetState } from "../types.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../constants.ts";

/**
 * Compute the regions of free column space where a new widget could be added.
 *
 * Covers trailing free columns in partially-filled rows and, when the dashboard
 * is empty, a single full-width slot. Framework-agnostic; consumed by the
 * `useEmptySlots` hook and the drag engine. Coordinates are in pixels relative
 * to the grid container's top-left corner.
 *
 * In a masonry layout a "row" is not a clean horizontal band: a tall widget in
 * an adjacent column can protrude into the band of a shorter row beside it. Each
 * slot's vertical extent therefore clears any widget occupying its free columns,
 * so a slot never overlaps a widget.
 */
export function computeEmptySlots(
  layout: ComputedLayout,
  widgets: readonly WidgetState[],
  maxColumns: number,
  gap: number,
  containerWidth: number,
): EmptySlot[] {
  if (containerWidth <= 0 || maxColumns <= 0) return [];
  const colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns;
  const colOf = (x: number) => Math.round(x / (colWidth + gap));

  const positioned: WidgetLayout[] = [];
  for (const w of widgets) {
    if (!w.visible) continue;
    const p = layout.positions.get(w.id);
    if (p) positioned.push(p);
  }

  if (positioned.length === 0) {
    return [
      {
        rowIndex: 0,
        columnStart: 0,
        colSpan: maxColumns,
        anchorId: null,
        x: 0,
        y: 0,
        width: containerWidth,
        height: DEFAULT_WIDGET_HEIGHT,
      },
    ];
  }

  const totalHeight = layout.totalHeight;

  const rowsMap = new Map<number, WidgetLayout[]>();
  for (const p of positioned) {
    const key = Math.round(p.y);
    const arr = rowsMap.get(key) ?? [];
    arr.push(p);
    rowsMap.set(key, arr);
  }

  const rowKeys = [...rowsMap.keys()].sort((a, b) => a - b);
  const slots: EmptySlot[] = [];
  for (let r = 0; r < rowKeys.length; r++) {
    const row = rowsMap.get(rowKeys[r]) ?? [];
    let last = row[0];
    for (const p of row) if (p.x > last.x) last = p;
    const occupiedEnd = colOf(last.x) + last.colSpan;
    const free = maxColumns - occupiedEnd;
    if (free <= 0) continue;

    const x = last.x + last.width + gap;
    const width = containerWidth - x;
    if (width <= 0) continue;

    let rowTop = row[0].y;
    let rowHeight = row[0].height;
    for (const p of row) {
      if (p.y < rowTop) rowTop = p.y;
      if (p.height > rowHeight) rowHeight = p.height;
    }

    let top = rowTop;
    for (const p of positioned) {
      if (p.y >= rowTop) continue;
      const pStart = colOf(p.x);
      const pEnd = pStart + p.colSpan;
      if (pEnd <= occupiedEnd || pStart >= maxColumns) continue;
      const bottom = p.y + p.height + gap;
      if (bottom > top) top = bottom;
    }

    let bottomLimit = totalHeight;
    for (const p of positioned) {
      if (p.y < top) continue;
      const pStart = colOf(p.x);
      const pEnd = pStart + p.colSpan;
      if (pEnd <= occupiedEnd || pStart >= maxColumns) continue;
      const limit = p.y - gap;
      if (limit < bottomLimit) bottomLimit = limit;
    }

    const height = Math.min(rowHeight, bottomLimit - top);
    if (height <= 0) continue;

    slots.push({ rowIndex: r, columnStart: occupiedEnd, colSpan: free, anchorId: last.id, x, y: top, width, height });
  }
  return slots;
}
