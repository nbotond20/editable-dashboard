import type { WidgetState, ComputedLayout, WidgetLayout } from "../types.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../constants.ts";

export function computeLayout(
  widgets: WidgetState[],
  heights: Map<string, number>,
  containerWidth: number,
  maxColumns: number,
  gap: number
): ComputedLayout {
  const positions = new Map<string, WidgetLayout>();

  if (containerWidth <= 0 || maxColumns <= 0 || widgets.length === 0) {
    return { positions, totalHeight: 0 };
  }

  const colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns;
  const columnHeights = new Array(maxColumns).fill(0);

  const visible = widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  for (const widget of visible) {
    const span = Math.max(1, Math.min(widget.colSpan, maxColumns));
    const widgetWidth = span * colWidth + (span - 1) * gap;
    const widgetHeight = heights.get(widget.id) ?? DEFAULT_WIDGET_HEIGHT;

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

    if (widget.columnStart != null) {
      const preferred = Math.max(
        0,
        Math.min(widget.columnStart, maxColumns - span)
      );
      let preferredY = 0;
      for (let c = preferred; c < preferred + span; c++) {
        preferredY = Math.max(preferredY, columnHeights[c]);
      }
      bestStartCol = preferred;
      bestY = preferredY;
    }

    const x = bestStartCol * (colWidth + gap);
    const y = bestY;

    positions.set(widget.id, {
      id: widget.id,
      x,
      y,
      width: widgetWidth,
      height: widgetHeight,
      colSpan: span,
    });

    for (let c = bestStartCol; c < bestStartCol + span; c++) {
      columnHeights[c] = y + widgetHeight + gap;
    }
  }

  const totalHeight = Math.max(0, Math.max(...columnHeights) - gap);

  return { positions, totalHeight };
}
