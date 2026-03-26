import type { DropZone, OperationIntent } from "./types.ts";
import type { WidgetState } from "../types.ts";

export interface IntentResolverConfig {
  swapDwellMs: number;
  resizeDwellMs: number;
  maxColumns: number;
  isLocked: (id: string) => boolean;
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
      return { type: "reorder", targetIndex: zone.index };
    }

    case "widget": {
      if (dwellMs < config.swapDwellMs) {
        return { type: "none" };
      }

      if (config.isLocked(zone.targetId)) {
        return { type: "none" };
      }

      if (dwellMs < config.resizeDwellMs) {
        return { type: "swap", targetId: zone.targetId };
      }

      // dwellMs >= resizeDwellMs: attempt auto-resize
      const targetWidget = widgets.find((w) => w.id === zone.targetId);
      if (!targetWidget) {
        return { type: "swap", targetId: zone.targetId };
      }

      if (config.maxColumns === 1) {
        // Can't fit two widgets in a single column; fall back to swap.
        return { type: "swap", targetId: zone.targetId };
      }

      let sourceSpan: number;
      let targetSpan: number;

      if (
        sourceWidget.colSpan + targetWidget.colSpan <=
        config.maxColumns
      ) {
        // Both fit as-is.
        sourceSpan = sourceWidget.colSpan;
        targetSpan = targetWidget.colSpan;
      } else {
        // Compute halfSpan and clamp to each widget's constraints.
        const halfSpan = Math.ceil(config.maxColumns / 2);

        const sourceConstraints = config.getWidgetConstraints(sourceWidget.id);
        sourceSpan = Math.max(
          sourceConstraints.minSpan,
          Math.min(sourceConstraints.maxSpan, halfSpan),
        );

        const targetConstraints = config.getWidgetConstraints(zone.targetId);
        targetSpan = Math.max(
          targetConstraints.minSpan,
          Math.min(targetConstraints.maxSpan, halfSpan),
        );
      }

      const targetIndex = widgets.indexOf(targetWidget);

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
        // Progress toward swap threshold.
        return swapDwellMs === 0 ? 1 : dwellMs / swapDwellMs;
      }
      if (dwellMs < resizeDwellMs) {
        // Progress toward resize threshold (from swap to resize).
        const range = resizeDwellMs - swapDwellMs;
        return range === 0 ? 1 : (dwellMs - swapDwellMs) / range;
      }
      // Past resize threshold.
      return 1;
    }
  }
}
