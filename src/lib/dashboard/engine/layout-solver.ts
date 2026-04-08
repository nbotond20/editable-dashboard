import type { WidgetState, ComputedLayout } from "../types.ts";
import type { OperationIntent } from "./types.ts";
import { computeLayout } from "../layout/compute-layout.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../constants.ts";
import { getPinnedIds } from "./utils.ts";

/**
 * After a cross-row swap where the source fills the target's entire row,
 * the target's row-mates are displaced. Preserve their relative column
 * order with the target so the greedy layout doesn't reverse them.
 */
export function preserveTargetRowOrder(
  widgets: WidgetState[],
  baseLayout: ComputedLayout,
  sourceId: string,
  targetId: string,
  maxColumns: number,
): WidgetState[] {
  const sourceWidget = widgets.find(w => w.id === sourceId);
  if (!sourceWidget || sourceWidget.colSpan < maxColumns) return widgets;

  const tgtPos = baseLayout.positions.get(targetId);
  if (!tgtPos) return widgets;

  const visible = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);
  const targetWidget = visible.find(w => w.id === targetId);
  if (!targetWidget) return widgets;

  for (const w of visible) {
    if (w.id === targetId || w.id === sourceId) continue;
    const pos = baseLayout.positions.get(w.id);
    if (!pos || Math.abs(pos.y - tgtPos.y) >= 1) continue;

    const targetWasLeft = tgtPos.x < pos.x;
    const targetIsFirst = targetWidget.order < w.order;

    if (targetWasLeft && !targetIsFirst) {
      const tgtOrder = targetWidget.order;
      const mateOrder = w.order;
      return widgets.map(ww => {
        if (ww.id === targetId) return { ...ww, order: mateOrder };
        if (ww.id === w.id) return { ...ww, order: tgtOrder };
        return ww;
      });
    }
  }

  return widgets;
}

export function pinToGreedyColumns(
  widgets: WidgetState[],
  maxColumns: number,
  excludeIds?: ReadonlySet<string>,
): WidgetState[] {
  const visible = widgets
    .filter(w => w.visible)
    .sort((a, b) => a.order - b.order);

  const colMap = new Map<string, number>();
  const rowUsed = new Array(maxColumns).fill(0);

  for (const w of visible) {
    const span = Math.max(1, Math.min(w.colSpan, maxColumns));

    if (excludeIds?.has(w.id) && w.columnStart != null) {
      const col = Math.max(0, Math.min(w.columnStart, maxColumns - span));
      for (let c = col; c < col + span; c++) {
        rowUsed[c] = rowUsed[c] + 1;
      }
      continue;
    }

    let bestCol = -1;
    let bestRow = Infinity;

    for (let startCol = 0; startCol <= maxColumns - span; startCol++) {
      let maxRow = 0;
      for (let c = startCol; c < startCol + span; c++) {
        maxRow = Math.max(maxRow, rowUsed[c]);
      }
      if (maxRow < bestRow) {
        bestRow = maxRow;
        bestCol = startCol;
      }
    }

    if (bestCol >= 0) {
      colMap.set(w.id, bestCol);
      for (let c = bestCol; c < bestCol + span; c++) {
        rowUsed[c] = bestRow + 1;
      }
    }
  }

  return widgets.map(w => {
    if (excludeIds?.has(w.id)) return w;
    const col = colMap.get(w.id);
    if (col != null) {
      return { ...w, columnStart: col };
    }
    return w;
  });
}

export function stabilizeUninvolvedWidgets(
  widgets: WidgetState[],
  baseLayout: ComputedLayout,
  involvedIds: ReadonlySet<string>,
  containerWidth: number,
  maxColumns: number,
  gap: number,
): WidgetState[] {
  if (maxColumns <= 1) return widgets;
  const colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns;
  const step = colWidth + gap;

  let changed = false;
  const result = widgets.map(w => {
    if (!w.visible || involvedIds.has(w.id) || w.columnStart != null) return w;
    const pos = baseLayout.positions.get(w.id);
    if (!pos) return w;
    changed = true;
    return { ...w, columnStart: Math.round(pos.x / step) };
  });

  return changed ? result : widgets;
}

/**
 * Find the optimal insertion index for a column-pinned widget.
 *
 * Simulates the greedy layout of `remainingWidgets` and returns the first
 * index where the source would be placed at a Y position that contains the
 * pointer. Falls back to appending at end.
 */
export function findColumnPinInsertionIndex(
  remainingWidgets: WidgetState[],
  targetColumn: number,
  pointerY: number | undefined,
  maxColumns: number,
  gap: number,
  heights: ReadonlyMap<string, number>,
  baseLayout?: ComputedLayout,
): number {
  if (pointerY == null) return remainingWidgets.length;

  if (baseLayout) {
    for (let i = 0; i < remainingWidgets.length; i++) {
      const pos = baseLayout.positions.get(remainingWidgets[i].id);
      if (pos && pos.y > pointerY) {
        return i;
      }
    }
    return remainingWidgets.length;
  }

  const columnHeights = new Array(maxColumns).fill(0);

  for (let i = 0; i < remainingWidgets.length; i++) {
    const w = remainingWidgets[i];
    const span = Math.max(1, Math.min(w.colSpan, maxColumns));
    const widgetHeight = heights.get(w.id) ?? DEFAULT_WIDGET_HEIGHT;

    let bestStartCol = 0;
    let bestY = Infinity;
    for (let startCol = 0; startCol <= maxColumns - span; startCol++) {
      let maxY = 0;
      for (let c = startCol; c < startCol + span; c++) {
        maxY = Math.max(maxY, columnHeights[c]);
      }
      if (maxY < bestY) {
        bestY = maxY;
        bestStartCol = startCol;
      }
    }
    if (w.columnStart != null) {
      bestStartCol = Math.max(0, Math.min(w.columnStart, maxColumns - span));
      bestY = 0;
      for (let c = bestStartCol; c < bestStartCol + span; c++) {
        bestY = Math.max(bestY, columnHeights[c]);
      }
    }

    const sourceY = columnHeights[targetColumn];
    if (sourceY <= pointerY && bestY > pointerY) {
      return i;
    }

    for (let c = bestStartCol; c < bestStartCol + span; c++) {
      columnHeights[c] = bestY + widgetHeight + gap;
    }
  }

  return remainingWidgets.length;
}

export interface LayoutSolverConfig {
  autoFillMode: "immediate" | "on-drop" | "none";
  maxColumns: number;
  gap: number;
}

/**
 * Splice the source widget out of the visible list and re-insert at
 * `targetIndex`, then reassign sequential order values.
 *
 * Returns `null` when `sourceId` is not found among the visible widgets.
 */
function reorderVisible(
  widgets: WidgetState[],
  sourceId: string,
  targetIndex: number,
  overrides?: Partial<WidgetState>,
): { reordered: WidgetState[]; hidden: WidgetState[] } | null {
  const visible = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);
  const sourceIdx = visible.findIndex(w => w.id === sourceId);
  if (sourceIdx === -1) return null;

  const reordered = [...visible];
  const [moved] = reordered.splice(sourceIdx, 1);
  const merged = overrides ? { ...moved, ...overrides } : moved;
  reordered.splice(targetIndex, 0, merged);

  const ordered = reordered.map((w, i) => ({ ...w, order: i }));
  const hidden = widgets.filter(w => !w.visible);
  return { reordered: ordered, hidden };
}

export function solveBaseLayout(
  widgets: WidgetState[],
  heights: ReadonlyMap<string, number>,
  containerWidth: number,
  config: LayoutSolverConfig
): ComputedLayout {
  return computeLayout(
    widgets,
    heights as Map<string, number>,
    containerWidth,
    config.maxColumns,
    config.gap
  );
}

export function solveDragLayout(
  widgets: WidgetState[],
  heights: ReadonlyMap<string, number>,
  containerWidth: number,
  config: LayoutSolverConfig,
  sourceId: string
): ComputedLayout {
  const sourceWidget = widgets.find(w => w.id === sourceId && w.visible);

  switch (config.autoFillMode) {
    case "immediate":
      return computeLayout(
        widgets,
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
        { excludeIds: new Set([sourceId]) }
      );

    case "on-drop":
    case "none": {
      if (!sourceWidget) {
        return solveBaseLayout(widgets, heights, containerWidth, config);
      }
      return computeLayout(
        widgets,
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
        {
          excludeIds: new Set([sourceId]),
          phantom: {
            id: `__phantom_${sourceId}`,
            colSpan: sourceWidget.colSpan,
            height: heights.get(sourceId) ?? DEFAULT_WIDGET_HEIGHT,
            order: sourceWidget.order,
            columnStart: sourceWidget.columnStart,
            rowStart: sourceWidget.rowStart,
          },
        }
      );
    }
  }
}

export function solvePreviewLayout(
  widgets: WidgetState[],
  heights: ReadonlyMap<string, number>,
  containerWidth: number,
  config: LayoutSolverConfig,
  intent: OperationIntent,
  sourceId: string,
  baseLayout?: ComputedLayout
): ComputedLayout {
  const fallback = () => solveDragLayout(widgets, heights, containerWidth, config, sourceId);

  widgets = widgets.some(w => w.rowStart != null)
    ? widgets.map(w => w.rowStart != null ? { ...w, rowStart: undefined } : w)
    : widgets;

  switch (intent.type) {
    case "none":
      return fallback();

    case "reorder": {
      const result = reorderVisible(widgets, sourceId, intent.targetIndex, { columnStart: undefined });
      if (!result) return fallback();
      const stabilized = baseLayout
        ? stabilizeUninvolvedWidgets(result.reordered, baseLayout, new Set([sourceId]), containerWidth, config.maxColumns, config.gap)
        : result.reordered;
      return computeLayout(
        [...stabilized, ...result.hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
      );
    }

    case "swap": {
      const visible = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const sourceWidget = visible.find(w => w.id === sourceId);
      const targetWidget = visible.find(w => w.id === intent.targetId);
      if (!sourceWidget || !targetWidget) return fallback();

      const srcCol = sourceWidget.columnStart;
      const tgtCol = targetWidget.columnStart;
      const samePinCol = srcCol != null && tgtCol != null && srcCol === tgtCol;

      let swapped = widgets.map(w => {
        if (samePinCol && (w.id === sourceId || w.id === intent.targetId)) {
          return { ...w, order: w.id === sourceId ? targetWidget.order : sourceWidget.order };
        }
        if (w.id === sourceId) {
          return { ...w, order: targetWidget.order, columnStart: tgtCol };
        }
        if (w.id === intent.targetId) {
          return { ...w, order: sourceWidget.order, columnStart: srcCol };
        }
        return w;
      });

      if (baseLayout) {
        swapped = preserveTargetRowOrder(swapped, baseLayout, sourceId, intent.targetId, config.maxColumns);
        const srcPos = baseLayout.positions.get(sourceId);
        const tgtPos = baseLayout.positions.get(intent.targetId);
        if (srcPos && tgtPos && Math.abs(srcPos.y - tgtPos.y) < 1) {
          swapped = stabilizeUninvolvedWidgets(swapped, baseLayout, new Set([sourceId, intent.targetId]), containerWidth, config.maxColumns, config.gap);
        }
      }

      const pinned = getPinnedIds(swapped);
      return computeLayout(
        pinToGreedyColumns(swapped, config.maxColumns, pinned),
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
      );
    }

    case "auto-resize": {
      const sourceWidget = widgets.find(w => w.id === sourceId);
      const targetWidget = widgets.find(w => w.id === intent.targetId);
      const srcCol = sourceWidget?.columnStart;
      const tgtCol = targetWidget?.columnStart;

      const resized = widgets.map(w => {
        if (w.id === sourceId) return { ...w, colSpan: intent.sourceSpan };
        if (w.id === intent.targetId) return { ...w, colSpan: intent.targetSpan };
        return w;
      });
      const resizedVisible = resized.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const sourceIdx = resizedVisible.findIndex(w => w.id === sourceId);
      if (sourceIdx === -1) return fallback();
      const reordered = [...resizedVisible];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(intent.targetIndex, 0, moved);

      let needsSwap = false;
      if (srcCol != null) {
        const withoutSource = resized.filter(w => w.visible && w.id !== sourceId).sort((a, b) => a.order - b.order);
        const checkLayout = computeLayout(
          withoutSource.map((w, i) => ({ ...w, order: i })),
          heights as Map<string, number>, containerWidth, config.maxColumns, config.gap,
        );
        const tgtPos = checkLayout.positions.get(intent.targetId);
        if (tgtPos) {
          const colW = (containerWidth - config.gap * (config.maxColumns - 1)) / config.maxColumns;
          let rowOcc = 0;
          for (const [, p] of checkLayout.positions) {
            if (Math.abs(p.y - tgtPos.y) < 1) {
              rowOcc += Math.max(1, Math.round((p.width + config.gap) / (colW + config.gap)));
            }
          }
          if (rowOcc + intent.sourceSpan > config.maxColumns) {
            needsSwap = true;
          }
        }

        if (!needsSwap && tgtCol != null) {
          const srcAfterTgt = reordered.findIndex(w => w.id === sourceId) > reordered.findIndex(w => w.id === intent.targetId);
          if (srcAfterTgt && srcCol < tgtCol) needsSwap = true;
          if (!srcAfterTgt && srcCol > tgtCol) needsSwap = true;
        }
      }

      if (needsSwap) {
        const tgtIdx = reordered.findIndex(w => w.id === intent.targetId);
        if (tgtIdx >= 0 && sourceIdx < reordered.length && tgtIdx !== sourceIdx) {
          const temp = reordered[tgtIdx];
          reordered[tgtIdx] = reordered[sourceIdx];
          reordered[sourceIdx] = temp;
        }
      }

      const spansUnchanged = intent.sourceSpan === sourceWidget?.colSpan && intent.targetSpan === targetWidget?.colSpan;
      const samePinCol = !needsSwap && spansUnchanged && srcCol != null && tgtCol != null && srcCol === tgtCol;
      const previewWidgets = reordered.map((w, i) => ({
        ...w,
        order: i,
        ...(w.id === sourceId
          ? { columnStart: needsSwap && tgtCol != null ? tgtCol : (samePinCol ? srcCol : undefined) }
          : {}),
        ...(w.id === intent.targetId
          ? { columnStart: needsSwap && srcCol != null ? srcCol : (samePinCol ? tgtCol : undefined) }
          : {}),
      }));
      const hidden = widgets.filter(w => !w.visible);

      if (srcCol != null || tgtCol != null) {
        const pinned = getPinnedIds(previewWidgets);
        return computeLayout(
          [...pinToGreedyColumns(previewWidgets, config.maxColumns, pinned), ...hidden],
          heights as Map<string, number>,
          containerWidth,
          config.maxColumns,
          config.gap,
        );
      }

      if (baseLayout) {
        const srcPos = baseLayout.positions.get(sourceId);
        const tgtPos = baseLayout.positions.get(intent.targetId);
        if (srcPos && tgtPos && Math.abs(srcPos.y - tgtPos.y) < 1) {
          const stabilize = (ws: WidgetState[], involved: ReadonlySet<string>) =>
            stabilizeUninvolvedWidgets(ws, baseLayout, involved, containerWidth, config.maxColumns, config.gap);
          const stabilizedPreview = stabilize(previewWidgets, new Set([sourceId, intent.targetId]));
          const pinned = getPinnedIds(stabilizedPreview);
          return computeLayout(
            [...pinToGreedyColumns(stabilizedPreview, config.maxColumns, pinned), ...hidden],
            heights as Map<string, number>,
            containerWidth,
            config.maxColumns,
            config.gap,
          );
        }
      }

      return computeLayout(
        [...pinToGreedyColumns(previewWidgets, config.maxColumns), ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
      );
    }

    case "column-pin": {
      const visible = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const visibleSorted = visible.filter(w => w.id !== sourceId);
      const source = visible.find(w => w.id === sourceId);
      if (!source) return fallback();
      const maxSpanAtCol = Math.max(1, config.maxColumns - intent.column);
      const pinnedSource = {
        ...source,
        columnStart: intent.column,
        colSpan: Math.min(source.colSpan, maxSpanAtCol),
      };
      const insertIdx = findColumnPinInsertionIndex(
        visibleSorted, intent.column, intent.pointerY,
        config.maxColumns, config.gap, heights,
        baseLayout,
      );
      const reordered = [...visibleSorted];
      reordered.splice(insertIdx, 0, pinnedSource);
      const previewWidgets = reordered.map((w, i) => ({ ...w, order: i }));
      const hidden = widgets.filter(w => !w.visible);
      return computeLayout(
        [...previewWidgets, ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
      );
    }

    case "empty-row-maximize": {
      const visible = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const visibleSorted = visible.filter(w => w.id !== sourceId);
      const source = visible.find(w => w.id === sourceId);
      if (!source) return fallback();
      const maximizedSource = {
        ...source,
        colSpan: intent.newSpan,
        columnStart: 0,
      };
      const insertIdx = findColumnPinInsertionIndex(
        visibleSorted, 0, intent.pointerY,
        config.maxColumns, config.gap, heights,
      );
      const reordered = [...visibleSorted];
      reordered.splice(insertIdx, 0, maximizedSource);
      const previewWidgets = reordered.map((w, i) => ({ ...w, order: i }));
      const hidden = widgets.filter(w => !w.visible);
      return computeLayout(
        [...previewWidgets, ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
      );
    }
  }
}
