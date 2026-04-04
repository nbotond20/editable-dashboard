import type { DropZone, OperationIntent } from "./types.ts";
import type { WidgetState } from "../types.ts";

export interface IntentResolverConfig {
  swapDwellMs: number;
  resizeDwellMs: number;
  maxColumns: number;
  isPositionLocked: (id: string) => boolean;
  canDrop: (sourceId: string, targetIndex: number) => boolean;
  getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number };
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

      const sourceIdx = widgets.findIndex(w => w.id === sourceWidget.id);
      if (sourceIdx >= 0 && zone.index !== sourceIdx) {
        const adjustedTarget = zone.index > sourceIdx ? zone.index - 1 : zone.index;
        const [lo, hi] = sourceIdx < adjustedTarget
          ? [sourceIdx + 1, adjustedTarget]
          : [adjustedTarget, sourceIdx - 1];
        for (let i = lo; i <= hi; i++) {
          if (widgets[i] && config.isPositionLocked(widgets[i].id)) {
            return { type: "none" };
          }
        }
      }

      return { type: "reorder", targetIndex: zone.index };
    }

    case "widget": {
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
          widgets, sourceWidget.id, zone.targetId, config.maxColumns,
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
      return { type: "column-pin", column: zone.column };
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
): number {
  switch (zone.type) {
    case "gap":
    case "empty":
      return 1;

    case "outside":
      return 0;

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
): number {
  const visible = visibleSorted;

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
