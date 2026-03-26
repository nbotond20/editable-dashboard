import type { WidgetState, ComputedLayout } from "../types.ts";
import type { OperationIntent } from "./types.ts";
import { computeLayout } from "../layout/compute-layout.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../constants.ts";

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
      // Remove source from flow, others repack
      return computeLayout(
        widgets,
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap,
        { excludeIds: new Set([sourceId]) }
      );

    case "on-drop":
      // Phantom holds position
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
          },
        }
      );

    case "none":
      // Same as on-drop (phantom holds position)
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
          },
        }
      );
  }
}

export function solvePreviewLayout(
  widgets: WidgetState[],
  heights: ReadonlyMap<string, number>,
  containerWidth: number,
  config: LayoutSolverConfig,
  intent: OperationIntent,
  sourceId: string
): ComputedLayout {
  // Apply the intent tentatively to widget state, then compute layout
  // This shows what the grid would look like after the drop
  const visible = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);

  switch (intent.type) {
    case "none":
      return solveDragLayout(widgets, heights, containerWidth, config, sourceId);

    case "reorder": {
      // Simulate reorder
      const sourceIdx = visible.findIndex(w => w.id === sourceId);
      if (sourceIdx === -1) return solveDragLayout(widgets, heights, containerWidth, config, sourceId);
      const reordered = [...visible];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(intent.targetIndex, 0, moved);
      const previewWidgets = reordered.map((w, i) => ({ ...w, order: i, columnStart: undefined }));
      // Include hidden widgets
      const hidden = widgets.filter(w => !w.visible);
      return computeLayout(
        [...previewWidgets, ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap
      );
    }

    case "swap": {
      // Exchange order of source and target
      const sourceWidget = visible.find(w => w.id === sourceId);
      const targetWidget = visible.find(w => w.id === intent.targetId);
      if (!sourceWidget || !targetWidget) return solveDragLayout(widgets, heights, containerWidth, config, sourceId);
      const swapped = widgets.map(w => {
        if (w.id === sourceId) return { ...w, order: targetWidget.order, columnStart: undefined };
        if (w.id === intent.targetId) return { ...w, order: sourceWidget.order, columnStart: undefined };
        return w;
      });
      return computeLayout(swapped, heights as Map<string, number>, containerWidth, config.maxColumns, config.gap);
    }

    case "auto-resize": {
      // Resize both and place adjacent
      const resized = widgets.map(w => {
        if (w.id === sourceId) return { ...w, colSpan: intent.sourceSpan };
        if (w.id === intent.targetId) return { ...w, colSpan: intent.targetSpan };
        return w;
      });
      // Also reorder source next to target
      const resizedVisible = resized.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const sourceIdx = resizedVisible.findIndex(w => w.id === sourceId);
      if (sourceIdx === -1) return solveDragLayout(widgets, heights, containerWidth, config, sourceId);
      const reordered = [...resizedVisible];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(intent.targetIndex, 0, moved);
      const previewWidgets = reordered.map((w, i) => ({ ...w, order: i, columnStart: undefined }));
      const hidden = widgets.filter(w => !w.visible);
      return computeLayout(
        [...previewWidgets, ...hidden],
        heights as Map<string, number>,
        containerWidth,
        config.maxColumns,
        config.gap
      );
    }

    case "column-pin": {
      const pinned = widgets.map(w =>
        w.id === sourceId ? { ...w, columnStart: intent.column } : w
      );
      return computeLayout(pinned, heights as Map<string, number>, containerWidth, config.maxColumns, config.gap);
    }
  }
}
