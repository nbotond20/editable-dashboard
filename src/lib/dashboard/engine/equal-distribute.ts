export interface EqualDistributeInput {
  rowSpans: ReadonlyArray<{ id: string; colSpan: number }>;
  sourceId: string;
  sourceSpan: number;
  sourceOriginalSpan: number;
  maxColumns: number;
  getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number };
  isResizeLocked: (id: string) => boolean;
}

export interface EqualDistributeResult {
  resize: ReadonlyArray<{ id: string; newSpan: number }>;
}

/** Computes equal redistribution of column spans when inserting a widget would overflow maxColumns. */
export function equalDistribute(input: EqualDistributeInput): EqualDistributeResult | null {
  const { rowSpans, sourceId, sourceSpan, sourceOriginalSpan, maxColumns, getWidgetConstraints, isResizeLocked } = input;

  const total = rowSpans.reduce((sum, w) => sum + w.colSpan, 0) + sourceSpan;
  if (total <= maxColumns) {
    return { resize: [] };
  }

  const ids: string[] = [...rowSpans.map((w) => w.id), sourceId];
  const originals: number[] = [...rowSpans.map((w) => w.colSpan), sourceOriginalSpan];

  const n = ids.length;
  const base = Math.floor(maxColumns / n);
  const remainder = maxColumns - base * n;
  const targetSpans = ids.map((_, i) => base + (i < remainder ? 1 : 0));

  for (let i = 0; i < n; i++) {
    const c = getWidgetConstraints(ids[i]);
    if (targetSpans[i] < c.minSpan) return null;
    if (targetSpans[i] > c.maxSpan) targetSpans[i] = c.maxSpan;
  }

  const distributed = targetSpans.reduce((sum, s) => sum + s, 0);
  if (distributed > maxColumns) return null;

  for (let i = 0; i < n; i++) {
    if (ids[i] === sourceId) continue;
    if (isResizeLocked(ids[i]) && targetSpans[i] !== originals[i]) return null;
  }

  const resize: Array<{ id: string; newSpan: number }> = [];
  for (let i = 0; i < n; i++) {
    if (targetSpans[i] !== originals[i]) {
      resize.push({ id: ids[i], newSpan: targetSpans[i] });
    }
  }

  return { resize };
}
