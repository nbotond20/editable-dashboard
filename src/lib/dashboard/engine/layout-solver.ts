import type { WidgetState, ComputedLayout } from "../types.ts";
import type { OperationIntent } from "./types.ts";
import { computeLayout } from "../layout/compute-layout.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../constants.ts";

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

export interface LayoutSolverConfig {
  autoFillMode: "immediate" | "on-drop" | "none";
  maxColumns: number;
  gap: number;
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
  const visible = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);

  const stabilize = (ws: WidgetState[], involved: ReadonlySet<string>) =>
    baseLayout
      ? stabilizeUninvolvedWidgets(ws, baseLayout, involved, containerWidth, config.maxColumns, config.gap)
      : ws;

  switch (intent.type) {
    case "none":
      return solveDragLayout(widgets, heights, containerWidth, config, sourceId);

    case "reorder": {
      const sourceIdx = visible.findIndex(w => w.id === sourceId);
      if (sourceIdx === -1) return solveDragLayout(widgets, heights, containerWidth, config, sourceId);
      const reordered = [...visible];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(intent.targetIndex, 0, moved);
      const previewWidgets = reordered.map((w, i) => ({
        ...w,
        order: i,
        ...(w.id === sourceId ? { columnStart: undefined } : {}),
      }));
      const hidden = widgets.filter(w => !w.visible);
      return computeLayout(
        [...stabilize(previewWidgets, new Set([sourceId])), ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap
      );
    }

    case "swap": {
      const sourceWidget = visible.find(w => w.id === sourceId);
      const targetWidget = visible.find(w => w.id === intent.targetId);
      if (!sourceWidget || !targetWidget) return solveDragLayout(widgets, heights, containerWidth, config, sourceId);

      const srcCol = sourceWidget.columnStart;
      const tgtCol = targetWidget.columnStart;

      const swapped = widgets.map(w => {
        if (w.id === sourceId) {
          return { ...w, order: targetWidget.order, columnStart: tgtCol };
        }
        if (w.id === intent.targetId) {
          return { ...w, order: sourceWidget.order, columnStart: srcCol };
        }
        return w;
      });
      const pinned = new Set<string>();
      for (const w of swapped) {
        if (w.visible && w.columnStart != null) pinned.add(w.id);
      }
      return computeLayout(
        pinToGreedyColumns(swapped, config.maxColumns, pinned.size > 0 ? pinned : undefined),
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap
      );
    }

    case "auto-resize": {
      const sourceWidget = widgets.find(w => w.id === sourceId);
      const srcCol = sourceWidget?.columnStart;

      const resized = widgets.map(w => {
        if (w.id === sourceId) return { ...w, colSpan: intent.sourceSpan };
        if (w.id === intent.targetId) return { ...w, colSpan: intent.targetSpan };
        return w;
      });
      const resizedVisible = resized.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const sourceIdx = resizedVisible.findIndex(w => w.id === sourceId);
      if (sourceIdx === -1) return solveDragLayout(widgets, heights, containerWidth, config, sourceId);
      const reordered = [...resizedVisible];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(intent.targetIndex, 0, moved);

      if (srcCol != null) {
        const tgtIdx = reordered.findIndex(w => w.id === intent.targetId);
        if (tgtIdx >= 0 && sourceIdx < reordered.length && tgtIdx !== sourceIdx) {
          const temp = reordered[tgtIdx];
          reordered[tgtIdx] = reordered[sourceIdx];
          reordered[sourceIdx] = temp;
        }
      }

      const previewWidgets = reordered.map((w, i) => ({
        ...w,
        order: i,
        ...(w.id === sourceId ? { columnStart: undefined } : {}),
        ...(w.id === intent.targetId
          ? { columnStart: srcCol != null ? srcCol : undefined }
          : {}),
      }));
      const hidden = widgets.filter(w => !w.visible);

      if (srcCol != null) {
        const pinned = new Set<string>();
        for (const pw of previewWidgets) {
          if (pw.visible && pw.columnStart != null) pinned.add(pw.id);
        }
        return computeLayout(
          [...pinToGreedyColumns(previewWidgets, config.maxColumns, pinned.size > 0 ? pinned : undefined), ...hidden],
          heights as Map<string, number>,
          containerWidth,
          config.maxColumns,
          config.gap
        );
      }

      return computeLayout(
        [...pinToGreedyColumns(previewWidgets, config.maxColumns), ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap
      );
    }

    case "column-pin": {
      const visibleSorted = visible.filter(w => w.id !== sourceId);
      const source = visible.find(w => w.id === sourceId);
      if (!source) return solveDragLayout(widgets, heights, containerWidth, config, sourceId);
      const reordered = [...visibleSorted, { ...source, columnStart: intent.column }];
      const previewWidgets = reordered.map((w, i) => ({ ...w, order: i }));
      const hidden = widgets.filter(w => !w.visible);
      return computeLayout(
        [...previewWidgets, ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap
      );
    }
  }
}
