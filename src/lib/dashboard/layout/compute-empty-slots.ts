import type { ComputedLayout, EmptySlot, WidgetLayout, WidgetState } from "../types.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../constants.ts";

/**
 * Compute the regions of free column space where a new widget could be added.
 *
 * Covers every free-column run in each partially-filled row — leading, interior
 * and trailing — and, when the dashboard is empty, a single full-width slot.
 * Vertically contiguous runs that occupy the same columns are merged into one
 * slot, so a free column stacked across several rows is reported once rather
 * than as one placeholder per row. Framework-agnostic; consumed by the
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
  const xOfCol = (c: number) => c * (colWidth + gap);
  const widthOfCols = (span: number) => span * colWidth + (span - 1) * gap;

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
        beforeId: null,
        afterId: null,
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
  const raw: EmptySlot[] = [];

  for (let r = 0; r < rowKeys.length; r++) {
    const row = rowsMap.get(rowKeys[r]) ?? [];

    // Map each grid column in this row to its occupying widget (null if free).
    const occupant: Array<WidgetLayout | null> = new Array(maxColumns).fill(null);
    for (const p of row) {
      const start = colOf(p.x);
      for (let c = start; c < start + p.colSpan && c < maxColumns; c++) occupant[c] = p;
    }

    let rowTop = row[0].y;
    let rowHeight = row[0].height;
    for (const p of row) {
      if (p.y < rowTop) rowTop = p.y;
      if (p.height > rowHeight) rowHeight = p.height;
    }

    // Walk the columns and emit a slot for each maximal run of free columns.
    let c = 0;
    while (c < maxColumns) {
      if (occupant[c] != null) {
        c++;
        continue;
      }
      let end = c;
      while (end < maxColumns && occupant[end] == null) end++;
      const runStart = c;
      const runSpan = end - runStart;
      c = end;

      const x = xOfCol(runStart);
      const width = widthOfCols(runSpan);
      if (width <= 0) continue;

      const leftWidget = runStart > 0 ? occupant[runStart - 1] : null;
      const rightWidget = end < maxColumns ? occupant[end] : null;
      const beforeId = leftWidget ? leftWidget.id : null;
      const afterId = rightWidget ? rightWidget.id : null;

      // Push the slot below any taller widget from an earlier row protruding into
      // these free columns.
      let top = rowTop;
      for (const p of positioned) {
        if (p.y >= rowTop) continue;
        const pStart = colOf(p.x);
        const pEnd = pStart + p.colSpan;
        if (pEnd <= runStart || pStart >= end) continue;
        const bottom = p.y + p.height + gap;
        if (bottom > top) top = bottom;
      }

      // Clip the slot above any later widget occupying these free columns.
      let bottomLimit = totalHeight;
      for (const p of positioned) {
        if (p.y < top) continue;
        const pStart = colOf(p.x);
        const pEnd = pStart + p.colSpan;
        if (pEnd <= runStart || pStart >= end) continue;
        const limit = p.y - gap;
        if (limit < bottomLimit) bottomLimit = limit;
      }

      const height = Math.min(rowHeight, bottomLimit - top);
      if (height <= 0) continue;

      raw.push({
        rowIndex: r,
        columnStart: runStart,
        colSpan: runSpan,
        beforeId,
        afterId,
        anchorId: beforeId ?? afterId,
        x,
        y: top,
        width,
        height,
      });
    }
  }

  // Merge vertically contiguous runs occupying the same columns into one slot,
  // so a free column stacked across several rows reads as a single placeholder.
  raw.sort((a, b) => a.columnStart - b.columnStart || a.colSpan - b.colSpan || a.y - b.y);
  const merged: EmptySlot[] = [];
  for (const slot of raw) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.columnStart === slot.columnStart &&
      prev.colSpan === slot.colSpan &&
      slot.y <= prev.y + prev.height + gap + 1
    ) {
      const bottom = Math.max(prev.y + prev.height, slot.y + slot.height);
      prev.height = bottom - prev.y;
      continue;
    }
    merged.push({ ...slot });
  }

  return merged;
}
