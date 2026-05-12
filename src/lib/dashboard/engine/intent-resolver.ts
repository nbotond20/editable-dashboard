import type { DropZone, OperationIntent } from "./types.ts";
import type { ComputedLayout, WidgetState } from "../types.ts";
import { equalDistribute } from "./equal-distribute.ts";

export interface IntentResolverConfig {
  swapDwellMs: number;
  resizeDwellMs: number;
  emptyRowMaximizeDwellMs: number;
  maxColumns: number;
  isPositionLocked: (id: string) => boolean;
  isResizeLocked: (id: string) => boolean;
  canDrop: (sourceId: string, targetIndex: number) => boolean;
  getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number };
  layout?: ComputedLayout;
  baseLayout?: ComputedLayout;
  pointerY?: number;
  dropMode?: "classic" | "lines";
}

export function resolveIntent(
  zone: DropZone,
  dwellMs: number,
  sourceWidget: WidgetState,
  widgets: WidgetState[],
  config: IntentResolverConfig,
): OperationIntent {
  switch (zone.type) {
    case "gap": {
      if (!config.canDrop(sourceWidget.id, zone.index)) {
        return { type: "none" };
      }

      if (crossesPositionLocked(widgets, sourceWidget.id, zone.index, config.isPositionLocked)) {
        return { type: "none" };
      }

      return { type: "reorder", targetIndex: zone.index };
    }

    case "widget": {
      if (config.dropMode === "lines") {
        if (config.isPositionLocked(zone.targetId)) {
          return { type: "none" };
        }
        return { type: "deferred-swap", targetId: zone.targetId };
      }

      if (dwellMs < config.swapDwellMs) {
        return { type: "none" };
      }

      if (config.isPositionLocked(zone.targetId)) {
        return { type: "none" };
      }

      if (dwellMs < config.resizeDwellMs) {
        return { type: "swap", targetId: zone.targetId };
      }

      const targetWidget = widgets.find((w) => w.id === zone.targetId);
      if (!targetWidget) {
        return { type: "swap", targetId: zone.targetId };
      }

      if (config.maxColumns === 1) {
        return { type: "swap", targetId: zone.targetId };
      }

      let sourceSpan: number;
      let targetSpan: number;

      if (
        sourceWidget.colSpan + targetWidget.colSpan <=
        config.maxColumns
      ) {
        const otherRowSpans = computeTargetRowNeighborSpans(
          widgets, sourceWidget.id, zone.targetId, config.maxColumns, config.baseLayout,
        );
        if (sourceWidget.colSpan + targetWidget.colSpan + otherRowSpans > config.maxColumns) {
          const targetConstraints = config.getWidgetConstraints(zone.targetId);
          sourceSpan = sourceWidget.colSpan;
          targetSpan = Math.max(
            targetConstraints.minSpan,
            Math.min(targetWidget.colSpan, config.maxColumns - sourceWidget.colSpan - otherRowSpans),
          );
        } else {
          sourceSpan = sourceWidget.colSpan;
          targetSpan = targetWidget.colSpan;
        }
      } else {
        const sourceConstraints = config.getWidgetConstraints(sourceWidget.id);
        const targetConstraints = config.getWidgetConstraints(zone.targetId);

        sourceSpan = Math.max(
          sourceConstraints.minSpan,
          Math.min(sourceConstraints.maxSpan, sourceWidget.colSpan, config.maxColumns - 1),
        );
        targetSpan = Math.max(
          targetConstraints.minSpan,
          Math.min(targetConstraints.maxSpan, config.maxColumns - sourceSpan),
        );

        if (sourceSpan + targetSpan > config.maxColumns) {
          sourceSpan = Math.max(
            sourceConstraints.minSpan,
            Math.min(sourceConstraints.maxSpan, config.maxColumns - targetSpan),
          );
        }
      }

      if (sourceSpan + targetSpan > config.maxColumns) {
        return { type: "swap", targetId: zone.targetId };
      }

      const sourceIdx = widgets.findIndex((w) => w.id === sourceWidget.id);
      const targetIdx = widgets.indexOf(targetWidget);

      const adjustedTargetIdx =
        sourceIdx < targetIdx ? targetIdx - 1 : targetIdx;

      const targetIndex =
        zone.side === "left"
          ? adjustedTargetIdx
          : adjustedTargetIdx + 1;

      if (
        sourceSpan === sourceWidget.colSpan &&
        targetSpan === targetWidget.colSpan &&
        targetIndex === sourceIdx
      ) {
        return { type: "swap", targetId: zone.targetId };
      }

      return {
        type: "auto-resize",
        targetId: zone.targetId,
        sourceSpan,
        targetSpan,
        targetIndex,
      };
    }

    case "empty": {
      if (
        dwellMs >= config.emptyRowMaximizeDwellMs &&
        config.layout &&
        config.pointerY != null
      ) {
        const constraints = config.getWidgetConstraints(sourceWidget.id);
        const maxSpan = Math.min(constraints.maxSpan, config.maxColumns);
        const isShrunk = sourceWidget.colSpan < config.maxColumns;
        const canMaximize =
          isShrunk &&
          maxSpan > sourceWidget.colSpan &&
          !config.isResizeLocked(sourceWidget.id);

        if (canMaximize && isEmptyRow(config.layout, config.pointerY, sourceWidget.id)) {
          return { type: "empty-row-maximize", newSpan: maxSpan, pointerY: config.pointerY };
        }
      }

      const maxSpanAtCol = Math.max(1, config.maxColumns - zone.column);
      if (sourceWidget.colSpan > maxSpanAtCol) {
        if (config.isResizeLocked(sourceWidget.id)) {
          return { type: "none" };
        }
        if (dwellMs < config.resizeDwellMs) {
          return { type: "none" };
        }
      }

      return { type: "column-pin", column: zone.column };
    }

    case "insertion-line-h": {
      if (crossesPositionLocked(widgets, sourceWidget.id, zone.insertionIndex, config.isPositionLocked)) {
        return { type: "none" };
      }
      const colSpan = newRowColSpan(sourceWidget, config);
      if (colSpan == null) return { type: "none" };
      return { type: "new-row", insertionIndex: zone.insertionIndex, colSpan };
    }

    case "insertion-line-v": {
      if (crossesPositionLocked(widgets, sourceWidget.id, zone.insertionIndex, config.isPositionLocked)) {
        return { type: "none" };
      }

      const row = findRowForLine(zone, widgets, config.layout, sourceWidget.id);
      if (!row) return { type: "none" };

      const result = equalDistribute({
        rowSpans: row.map((w) => ({ id: w.id, colSpan: w.colSpan })),
        sourceId: sourceWidget.id,
        sourceSpan: sourceWidget.colSpan,
        sourceOriginalSpan: sourceWidget.colSpan,
        maxColumns: config.maxColumns,
        getWidgetConstraints: config.getWidgetConstraints,
        isResizeLocked: config.isResizeLocked,
      });

      if (!result) return { type: "none" };

      return {
        type: "in-row-insert",
        insertionIndex: zone.insertionIndex,
        resize: result.resize,
      };
    }

    case "outside": {
      return { type: "none" };
    }
  }
}

export function computeDwellProgress(
  zone: DropZone,
  dwellMs: number,
  swapDwellMs: number,
  resizeDwellMs: number,
  emptyRowMaximizeDwellMs?: number,
): number {
  switch (zone.type) {
    case "gap":
      return 1;

    case "empty": {
      if (emptyRowMaximizeDwellMs != null && emptyRowMaximizeDwellMs > 0) {
        return Math.min(1, dwellMs / emptyRowMaximizeDwellMs);
      }
      return 1;
    }

    case "outside":
      return 0;

    case "insertion-line-h":
    case "insertion-line-v":
      return 1;

    case "widget": {
      if (dwellMs < swapDwellMs) {
        return swapDwellMs === 0 ? 1 : dwellMs / swapDwellMs;
      }
      if (dwellMs < resizeDwellMs) {
        const range = resizeDwellMs - swapDwellMs;
        return range === 0 ? 1 : (dwellMs - swapDwellMs) / range;
      }
      return 1;
    }
  }
}

function computeTargetRowNeighborSpans(
  visibleSorted: WidgetState[],
  sourceId: string,
  targetId: string,
  maxColumns: number,
  layout?: ComputedLayout,
): number {
  const visible = visibleSorted;

  if (layout) {
    const tgtPos = layout.positions.get(targetId);
    if (!tgtPos) return 0;

    let neighborSpans = 0;
    for (const w of visible) {
      if (w.id === sourceId || w.id === targetId) continue;
      const pos = layout.positions.get(w.id);
      if (!pos) continue;
      if (Math.abs(pos.y - tgtPos.y) < 1) {
        neighborSpans += Math.max(1, Math.min(w.colSpan, maxColumns));
      }
    }
    return neighborSpans;
  }

  const rowUsed = new Array(maxColumns).fill(0);
  const widgetRow = new Map<string, number>();

  for (const w of visible) {
    if (w.id === sourceId) continue;
    const span = Math.max(1, Math.min(w.colSpan, maxColumns));
    let bestRow = Infinity;
    for (let startCol = 0; startCol <= maxColumns - span; startCol++) {
      let maxRow = 0;
      for (let c = startCol; c < startCol + span; c++) {
        maxRow = Math.max(maxRow, rowUsed[c]);
      }
      if (maxRow < bestRow) bestRow = maxRow;
    }
    widgetRow.set(w.id, bestRow);
    for (let startCol = 0; startCol <= maxColumns - span; startCol++) {
      let maxRow = 0;
      for (let c = startCol; c < startCol + span; c++) {
        maxRow = Math.max(maxRow, rowUsed[c]);
      }
      if (maxRow === bestRow) {
        for (let c = startCol; c < startCol + span; c++) {
          rowUsed[c] = bestRow + 1;
        }
        break;
      }
    }
  }

  const targetRow = widgetRow.get(targetId);
  if (targetRow == null) return 0;

  let neighborSpans = 0;
  for (const w of visible) {
    if (w.id === sourceId || w.id === targetId) continue;
    if (widgetRow.get(w.id) === targetRow) {
      neighborSpans += Math.max(1, Math.min(w.colSpan, maxColumns));
    }
  }
  return neighborSpans;
}

function isEmptyRow(
  layout: ComputedLayout,
  pointerY: number,
  sourceId: string,
): boolean {
  for (const [id, pos] of layout.positions) {
    if (id === sourceId) continue;
    if (id.startsWith("__phantom_")) continue;
    if (pointerY >= pos.y && pointerY < pos.y + pos.height) {
      return false;
    }
  }
  return true;
}

export function crossesPositionLocked(
  widgets: readonly WidgetState[],
  sourceId: string,
  targetIndex: number,
  isPositionLocked: (id: string) => boolean,
): boolean {
  const sourceIdx = widgets.findIndex((w) => w.id === sourceId);
  if (sourceIdx < 0 || targetIndex === sourceIdx) return false;
  const adjustedTarget = targetIndex > sourceIdx ? targetIndex - 1 : targetIndex;
  const [lo, hi] = sourceIdx < adjustedTarget
    ? [sourceIdx + 1, adjustedTarget]
    : [adjustedTarget, sourceIdx - 1];
  for (let i = lo; i <= hi; i++) {
    if (widgets[i] && isPositionLocked(widgets[i].id)) return true;
  }
  return false;
}

export function newRowColSpan(
  source: WidgetState,
  config: { maxColumns: number; isResizeLocked: (id: string) => boolean; getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number } },
): number | null {
  if (config.isResizeLocked(source.id)) {
    return source.colSpan <= config.maxColumns ? source.colSpan : null;
  }
  const c = config.getWidgetConstraints(source.id);
  const span = Math.max(c.minSpan, Math.min(config.maxColumns, c.maxSpan));
  if (span < c.minSpan || span > config.maxColumns) return null;
  return span;
}

function findRowForLine(
  zone: Extract<DropZone, { type: "insertion-line-v" }>,
  widgets: readonly WidgetState[],
  layout: ComputedLayout | undefined,
  sourceId: string,
): WidgetState[] | null {
  if (!layout) return null;

  const anchorId = zone.beforeId ?? zone.afterId;
  if (anchorId == null) return null;

  const anchorPos = layout.positions.get(anchorId);
  if (!anchorPos) return null;

  const row: WidgetState[] = [];
  for (const w of widgets) {
    if (!w.visible) continue;
    if (w.id === sourceId) continue;
    const pos = layout.positions.get(w.id);
    if (!pos) continue;
    if (Math.abs(pos.y - anchorPos.y) < 1) {
      row.push(w);
    }
  }
  return row;
}
