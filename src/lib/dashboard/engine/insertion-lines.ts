import type { ComputedLayout, WidgetState } from "../types.ts";
import type { InsertionLine, InsertionLineSegment, InsertionInvalidReason, Point } from "./types.ts";
import { LINE_SNAP_HYSTERESIS, DEFAULT_LINE_CORNER_INSET } from "../constants.ts";
import { equalDistribute } from "./equal-distribute.ts";
import { crossesPositionLocked, newRowColSpan } from "./intent-resolver.ts";

export interface ComputeInsertionLinesInput {
  layout: ComputedLayout;
  widgets: readonly WidgetState[];
  sourceId: string | null;
  dropMode: "classic" | "lines";
  maxColumns: number;
  containerWidth: number;
  cornerInset?: number;
  isPositionLocked: (id: string) => boolean;
  isResizeLocked: (id: string) => boolean;
  getWidgetConstraints?: (id: string) => { minSpan: number; maxSpan: number };
  autoResize?: boolean;
}

interface PositionedWidget {
  id: string;
  order: number;
  colSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeInsertionLines(input: ComputeInsertionLinesInput): InsertionLine[] {
  const { layout, widgets, sourceId, dropMode, maxColumns, containerWidth, isPositionLocked, isResizeLocked } = input;
  const cornerInset = input.cornerInset ?? DEFAULT_LINE_CORNER_INSET;
  const getWidgetConstraints = input.getWidgetConstraints ?? (() => ({ minSpan: 1, maxSpan: maxColumns }));
  const autoResize = input.autoResize;

  if (dropMode === "classic") return [];
  if (sourceId != null && isPositionLocked(sourceId)) return [];

  const visibleSorted = widgets
    .filter((w) => w.visible)
    .slice()
    .sort((a, b) => a.order - b.order);
  const sourceWidgetRef = sourceId != null ? widgets.find((w) => w.id === sourceId) ?? null : null;

  const crosses = (insertionIndex: number): boolean =>
    sourceId != null && crossesPositionLocked(visibleSorted, sourceId, insertionIndex, isPositionLocked);

  const vLineFeasible = (row: PositionedWidget[]): boolean => {
    if (!sourceWidgetRef) {
      const stationary = row.filter((w) => w.id !== sourceId);
      const totalSpan = stationary.reduce((sum, w) => sum + w.colSpan, 0);
      if (totalSpan + 1 <= maxColumns) return true;
      if (autoResize === false) return false;
      return !stationary.some((w) => isResizeLocked(w.id));
    }
    const stationary = row.filter((w) => w.id !== sourceId);
    const result = equalDistribute({
      rowSpans: stationary.map((w) => ({ id: w.id, colSpan: w.colSpan })),
      sourceId: sourceWidgetRef.id,
      sourceSpan: sourceWidgetRef.colSpan,
      sourceOriginalSpan: sourceWidgetRef.colSpan,
      maxColumns,
      getWidgetConstraints,
      isResizeLocked,
    });
    if (result == null) return false;
    if (autoResize === false) return result.resize.length === 0;
    return true;
  };

  const hLineFeasibleValue = !sourceWidgetRef
    ? true
    : newRowColSpan(sourceWidgetRef, { maxColumns, isResizeLocked, getWidgetConstraints, autoResize }) != null;
  const hLineFeasible = (): boolean => hLineFeasibleValue;

  const classifyRowInfeasibility = (row: PositionedWidget[]): InsertionInvalidReason => {
    if (!sourceWidgetRef) return "column-overflow";
    if (autoResize === false) return "column-overflow";
    const c = getWidgetConstraints(sourceWidgetRef.id);
    const sourceMin = isResizeLocked(sourceWidgetRef.id) ? sourceWidgetRef.colSpan : c.minSpan;
    if (sourceMin >= maxColumns) return "only-full-width";
    if (row.some((w) => w.id !== sourceId && isResizeLocked(w.id))) return "resize-locked";
    return "column-overflow";
  };

  const vLineReason = (
    insertionIdx: number,
    rowFeasible: boolean,
    rowReason: InsertionInvalidReason | undefined,
  ): InsertionInvalidReason | undefined => {
    if (crosses(insertionIdx)) return "position-locked";
    if (!rowFeasible) return rowReason;
    return undefined;
  };

  const hLineReason = (insertionIdx: number): InsertionInvalidReason | undefined => {
    if (crosses(insertionIdx)) return "position-locked";
    if (!hLineFeasible()) return "column-overflow";
    return undefined;
  };

  const allPositioned: PositionedWidget[] = [];
  for (const w of widgets) {
    if (!w.visible) continue;
    const pos = layout.positions.get(w.id);
    if (!pos) continue;
    allPositioned.push({ id: w.id, order: w.order, colSpan: w.colSpan, x: pos.x, y: pos.y, width: pos.width, height: pos.height });
  }

  if (
    allPositioned.length === 0 ||
    (allPositioned.length === 1 && allPositioned[0].id === sourceId)
  ) {
    return [
      {
        id: "h-null-null-0",
        orientation: "horizontal",
        x1: 0, y1: 0, x2: containerWidth, y2: 0,
        segments: [{ x1: 0, y1: 0, x2: containerWidth, y2: 0, anchorId: null, edge: null }],
        insertionIndex: 0,
        beforeId: null,
        afterId: null,
        rowIndex: 0,
        isActive: false,
        disabled: false,
      },
    ];
  }

  const stepForCol = maxColumns > 0
    ? containerWidth / maxColumns
    : containerWidth;
  const colOfWidget = (w: PositionedWidget) => Math.round(w.x / stepForCol);
  const nextRowForCol = new Array(maxColumns).fill(0);
  const rowIndexById = new Map<string, number>();
  const sortedByOrder = allPositioned.slice().sort((a, b) => a.order - b.order);
  for (const w of sortedByOrder) {
    const col = colOfWidget(w);
    let row = 0;
    for (let c = col; c < col + w.colSpan && c < maxColumns; c++) {
      row = Math.max(row, nextRowForCol[c]);
    }
    for (let c = col; c < col + w.colSpan && c < maxColumns; c++) {
      nextRowForCol[c] = row + 1;
    }
    rowIndexById.set(w.id, row);
  }

  const rowsMap = new Map<number, PositionedWidget[]>();
  for (const w of allPositioned) {
    const r = rowIndexById.get(w.id) ?? 0;
    const arr = rowsMap.get(r) ?? [];
    arr.push(w);
    rowsMap.set(r, arr);
  }
  const rows: PositionedWidget[][] = [...rowsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, arr]) => arr);
  for (const row of rows) row.sort((a, b) => a.x - b.x);

  const includedSorted = visibleSorted;
  let sourceIncludedIdx = -1;
  if (sourceId != null) {
    for (let i = 0; i < includedSorted.length; i++) {
      if (includedSorted[i].id === sourceId) { sourceIncludedIdx = i; break; }
    }
  }
  const excludedSorted: WidgetState[] = sourceId != null
    ? includedSorted.filter((w) => w.id !== sourceId)
    : includedSorted;
  const excludedIndexById = new Map<string, number>();
  for (let i = 0; i < excludedSorted.length; i++) {
    excludedIndexById.set(excludedSorted[i].id, i);
  }
  const excludedLength = excludedSorted.length;

  function indexOfExcluded(id: string | null): number {
    if (id == null) return -1;
    const idx = excludedIndexById.get(id);
    return idx === undefined ? -1 : idx;
  }

  function insertionIndexFromAfter(afterId: string | null): number {
    if (afterId == null) return excludedLength;
    const idx = excludedIndexById.get(afterId);
    return idx === undefined ? excludedLength : idx;
  }

  function isSelfAdjacentByOrder(insertionIdx: number): boolean {
    return sourceIncludedIdx >= 0 && insertionIdx === sourceIncludedIdx;
  }

  const sourceWidget = sourceWidgetRef;
  const sourceSpan = sourceWidget?.colSpan ?? 1;

  function isLineSelfAdjacent(insertionIdx: number, row: PositionedWidget[]): boolean {
    if (!isSelfAdjacentByOrder(insertionIdx)) return false;
    let stationaryTotal = 0;
    for (const w of row) if (w.id !== sourceId) stationaryTotal += w.colSpan;
    return stationaryTotal + sourceSpan <= maxColumns;
  }

  function vRightSideWidget(row: PositionedWidget[], boundaryIdx: number): PositionedWidget | null {
    for (let i = boundaryIdx; i < row.length; i++) {
      if (row[i].id !== sourceId) return row[i];
    }
    return null;
  }

  function vInsertionIndex(row: PositionedWidget[], boundaryIdx: number): number {
    const right = vRightSideWidget(row, boundaryIdx);
    if (right) return insertionIndexFromAfter(right.id);
    const last = lastNonSource(row);
    if (last) {
      const idx = indexOfExcluded(last.id);
      if (idx !== -1) return idx + 1;
    }
    return excludedLength;
  }

  const sourceRowIndex = sourceId != null ? rowIndexById.get(sourceId) : undefined;
  const sourceRowWidgets = sourceRowIndex !== undefined ? (rowsMap.get(sourceRowIndex) ?? []) : [];
  const sourceAloneInRow = sourceRowWidgets.length === 1 && sourceRowWidgets[0].id === sourceId;

  let gapPx = 16;
  for (const row of rows) {
    if (row.length > 1) {
      gapPx = Math.max(0, row[1].x - (row[0].x + row[0].width));
      break;
    }
  }
  const halfGap = gapPx / 2;

  function widgetTopSegment(w: PositionedWidget): InsertionLineSegment {
    const inset = Math.min(cornerInset, w.width / 2);
    const y = w.y - halfGap;
    return { x1: w.x + inset, y1: y, x2: w.x + w.width - inset, y2: y, anchorId: w.id, edge: "top" };
  }

  function widgetBottomSegment(w: PositionedWidget): InsertionLineSegment {
    const inset = Math.min(cornerInset, w.width / 2);
    const y = w.y + w.height + halfGap;
    return { x1: w.x + inset, y1: y, x2: w.x + w.width - inset, y2: y, anchorId: w.id, edge: "bottom" };
  }

  function widgetLeftSegment(w: PositionedWidget): InsertionLineSegment {
    const inset = Math.min(cornerInset, w.height / 2);
    const x = w.x - halfGap;
    return { x1: x, y1: w.y + inset, x2: x, y2: w.y + w.height - inset, anchorId: w.id, edge: "left" };
  }

  function widgetRightSegment(w: PositionedWidget): InsertionLineSegment {
    const inset = Math.min(cornerInset, w.height / 2);
    const x = w.x + w.width + halfGap;
    return { x1: x, y1: w.y + inset, x2: x, y2: w.y + w.height - inset, anchorId: w.id, edge: "right" };
  }

  function firstNonSource(row: PositionedWidget[]): PositionedWidget | null {
    for (const w of row) if (w.id !== sourceId) return w;
    return null;
  }

  function lastNonSource(row: PositionedWidget[]): PositionedWidget | null {
    for (let i = row.length - 1; i >= 0; i--) if (row[i].id !== sourceId) return row[i];
    return null;
  }

  const lines: InsertionLine[] = [];

  function vBoundingBox(segments: InsertionLineSegment[]): { x1: number; y1: number; x2: number; y2: number } {
    const x = segments[0].x1;
    let y1 = segments[0].y1;
    let y2 = segments[0].y2;
    for (let i = 1; i < segments.length; i++) {
      const s = segments[i];
      if (s.y1 < y1) y1 = s.y1;
      if (s.y2 > y2) y2 = s.y2;
    }
    return { x1: x, y1, x2: x, y2 };
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    if (maxColumns > 1) {
      const rowFeasible = vLineFeasible(row);
      const rowReason = rowFeasible ? undefined : classifyRowInfeasibility(row);

      const first = row[0];
      const outerLeftIdx = vInsertionIndex(row, 0);
      const outerLeftAfterId: string | null = first.id;
      const adjacentToSourceLeft = first.id === sourceId;
      const outerLeftSegs: InsertionLineSegment[] = [widgetLeftSegment(first)];
      const outerLeftBB = vBoundingBox(outerLeftSegs);
      lines.push({
        id: `v-start-${outerLeftAfterId}-${r}`,
        orientation: "vertical",
        x1: outerLeftBB.x1, y1: outerLeftBB.y1, x2: outerLeftBB.x2, y2: outerLeftBB.y2,
        segments: outerLeftSegs,
        insertionIndex: outerLeftIdx,
        beforeId: null,
        afterId: outerLeftAfterId,
        isActive: false,
        disabled: adjacentToSourceLeft || isLineSelfAdjacent(outerLeftIdx, row) || !rowFeasible || crosses(outerLeftIdx),
        disabledReason: vLineReason(outerLeftIdx, rowFeasible, rowReason),
      });

      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i];
        const b = row[i + 1];
        const adjacentToSource = a.id === sourceId || b.id === sourceId;
        const midIdx = vInsertionIndex(row, i + 1);
        const midSegs: InsertionLineSegment[] = [widgetRightSegment(a), widgetLeftSegment(b)];
        const midBB = vBoundingBox(midSegs);
        lines.push({
          id: `v-${a.id}-${b.id}-${r}`,
          orientation: "vertical",
          x1: midBB.x1, y1: midBB.y1, x2: midBB.x2, y2: midBB.y2,
          segments: midSegs,
          insertionIndex: midIdx,
          beforeId: a.id,
          afterId: b.id,
          isActive: false,
          disabled: adjacentToSource || !rowFeasible || isLineSelfAdjacent(midIdx, row) || crosses(midIdx),
          disabledReason: vLineReason(midIdx, rowFeasible, rowReason),
        });
      }

      const last = row[row.length - 1];
      const outerRightIdx = vInsertionIndex(row, row.length);
      const outerRightBeforeId: string | null = last.id;
      const adjacentToSourceRight = last.id === sourceId;
      const outerRightSegs: InsertionLineSegment[] = [widgetRightSegment(last)];
      const outerRightBB = vBoundingBox(outerRightSegs);
      lines.push({
        id: `v-${outerRightBeforeId}-end-${r}`,
        orientation: "vertical",
        x1: outerRightBB.x1, y1: outerRightBB.y1, x2: outerRightBB.x2, y2: outerRightBB.y2,
        segments: outerRightSegs,
        insertionIndex: outerRightIdx,
        beforeId: outerRightBeforeId,
        afterId: null,
        isActive: false,
        disabled: adjacentToSourceRight || isLineSelfAdjacent(outerRightIdx, row) || !rowFeasible || crosses(outerRightIdx),
        disabledReason: vLineReason(outerRightIdx, rowFeasible, rowReason),
      });
    }
  }

  for (let r = 0; r <= rows.length; r++) {
    const segments: InsertionLineSegment[] = [];
    const above = r > 0 ? rows[r - 1] : null;
    const below = r < rows.length ? rows[r] : null;

    if (above) {
      for (const w of above) segments.push(widgetBottomSegment(w));
    }
    if (below) {
      for (const w of below) segments.push(widgetTopSegment(w));
    }

    if (segments.length === 0) continue;

    const aboveLast = above ? lastNonSource(above) : null;
    const belowFirst = below ? firstNonSource(below) : null;
    const beforeId = aboveLast ? aboveLast.id : null;
    const afterId = belowFirst ? belowFirst.id : null;

    const insertionIdx = afterId != null
      ? insertionIndexFromAfter(afterId)
      : beforeId != null
        ? indexOfExcluded(beforeId) + 1
        : excludedLength;

    const aboveAloneSource = above != null && above.length === 1 && above[0].id === sourceId;
    const belowAloneSource = below != null && below.length === 1 && below[0].id === sourceId;
    const sourceFullWidth = sourceId != null && (sourceWidget?.colSpan ?? 0) >= maxColumns;
    const disabled =
      (sourceAloneInRow && sourceFullWidth && (aboveAloneSource || belowAloneSource)) ||
      !hLineFeasible() ||
      crosses(insertionIdx);

    const deduped = dedupeContainedSegments(segments, "horizontal");
    let bx1 = deduped[0].x1;
    let by1 = deduped[0].y1;
    let bx2 = deduped[0].x2;
    let by2 = deduped[0].y2;
    for (let i = 1; i < deduped.length; i++) {
      const s = deduped[i];
      if (s.x1 < bx1) bx1 = s.x1;
      if (s.y1 < by1) by1 = s.y1;
      if (s.x2 > bx2) bx2 = s.x2;
      if (s.y2 > by2) by2 = s.y2;
    }

    lines.push({
      id: `h-${beforeId ?? "start"}-${afterId ?? "end"}-${r}`,
      orientation: "horizontal",
      x1: bx1, y1: by1, x2: bx2, y2: by2,
      segments: deduped,
      insertionIndex: insertionIdx,
      beforeId,
      afterId,
      rowIndex: r,
      isActive: false,
      disabled,
      disabledReason: hLineReason(insertionIdx),
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.orientation !== "vertical" || !l.segments || l.segments.length < 2) continue;
    const deduped = dedupeContainedSegments(l.segments, "vertical");
    if (deduped.length === l.segments.length) continue;
    let bx1 = deduped[0].x1;
    let by1 = deduped[0].y1;
    let bx2 = deduped[0].x2;
    let by2 = deduped[0].y2;
    for (let j = 1; j < deduped.length; j++) {
      const s = deduped[j];
      if (s.x1 < bx1) bx1 = s.x1;
      if (s.y1 < by1) by1 = s.y1;
      if (s.x2 > bx2) bx2 = s.x2;
      if (s.y2 > by2) by2 = s.y2;
    }
    lines[i] = { ...l, segments: deduped, x1: bx1, y1: by1, x2: bx2, y2: by2 };
  }

  return lines;
}

function dedupeContainedSegments(
  segments: ReadonlyArray<InsertionLineSegment>,
  orientation: "horizontal" | "vertical",
): InsertionLineSegment[] {
  if (segments.length < 2) return segments.slice();
  const projected = segments.map((s, i) => ({
    s,
    i,
    lo: orientation === "horizontal" ? s.x1 : s.y1,
    hi: orientation === "horizontal" ? s.x2 : s.y2,
  }));
  projected.sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo) || a.i - b.i);
  const keptSet = new Set<number>();
  const keptItems: typeof projected = [];
  for (const p of projected) {
    const dominated = keptItems.some((k) => k.lo <= p.lo && k.hi >= p.hi);
    if (!dominated) {
      keptItems.push(p);
      keptSet.add(p.i);
    }
  }
  if (keptSet.size === segments.length) return segments.slice();
  return segments.filter((_, i) => keptSet.has(i));
}

export interface FindSnappedLineInput {
  pointer: Point;
  lines: ReadonlyArray<InsertionLine>;
  snapRadius: number;
  previousLineId: string | null;
}

export function findSnappedLine(input: FindSnappedLineInput): InsertionLine | null {
  const { pointer, lines, snapRadius, previousLineId } = input;
  const outerRadius = snapRadius + LINE_SNAP_HYSTERESIS;
  const px = pointer.x;
  const py = pointer.y;

  let best: InsertionLine | null = null;
  let bestDist = Infinity;
  let previousLine: InsertionLine | null = null;
  let previousDist = Infinity;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.disabled) continue;
    const isPrev = line.id === previousLineId;
    if (
      px < line.x1 - outerRadius || px > line.x2 + outerRadius ||
      py < line.y1 - outerRadius || py > line.y2 + outerRadius
    ) {
      if (isPrev) {
        previousLine = line;
        previousDist = Infinity;
      }
      continue;
    }
    const dist = pointerLineDistance(pointer, line);
    if (isPrev) {
      previousLine = line;
      previousDist = dist;
    }
    if (dist <= snapRadius && dist < bestDist) {
      best = line;
      bestDist = dist;
    }
  }

  if (previousLine && previousDist <= outerRadius) {
    return previousLine;
  }

  return best;
}

export function pointerLineDistance(p: Point, line: InsertionLine): number {
  const segs: ReadonlyArray<InsertionLineSegment> = line.segments && line.segments.length > 0
    ? line.segments
    : [{ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, anchorId: null, edge: null }];
  let best = Infinity;
  for (const s of segs) {
    const d = pointerSegmentDistance(p, line.orientation, s);
    if (d < best) best = d;
  }
  return best;
}

export function pointerSegmentDistance(p: Point, orientation: "horizontal" | "vertical", s: InsertionLineSegment): number {
  if (orientation === "vertical") {
    if (p.y >= s.y1 && p.y <= s.y2) return Math.abs(p.x - s.x1);
    const dy = p.y < s.y1 ? s.y1 - p.y : p.y - s.y2;
    return Math.hypot(p.x - s.x1, dy);
  }
  if (p.x >= s.x1 && p.x <= s.x2) return Math.abs(p.y - s.y1);
  const dx = p.x < s.x1 ? s.x1 - p.x : p.x - s.x2;
  return Math.hypot(dx, p.y - s.y1);
}

