import type { WidgetState, ComputedLayout, WidgetLayout } from "../types.ts";
import type { LayoutOptions } from "../engine/types.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../constants.ts";

/**
 * Run the bin-packing layout algorithm to compute widget positions.
 *
 * Iterates over visible widgets (sorted by `order`) and greedily places each
 * one in the column with the lowest current height, producing a masonry-style
 * layout. Widgets with a `columnStart` hint are pinned to that column.
 *
 * Can be used outside of React for server-side rendering, testing, or
 * generating preview thumbnails.
 *
 * @param widgets - Widget instances to lay out.
 * @param heights - Known heights for each widget ID. Missing entries use `DEFAULT_WIDGET_HEIGHT` (200px).
 * @param containerWidth - Container width in pixels.
 * @param maxColumns - Number of grid columns.
 * @param gap - Gap between widgets in pixels.
 * @param options - Advanced options for phantom elements and exclusions (used internally by the drag engine).
 * @returns A {@link ComputedLayout} with `positions` and `totalHeight`.
 */
export function computeLayout(
  widgets: WidgetState[],
  heights: Map<string, number>,
  containerWidth: number,
  maxColumns: number,
  gap: number,
  options?: LayoutOptions
): ComputedLayout {
  const positions = new Map<string, WidgetLayout>();

  if (containerWidth <= 0 || maxColumns <= 0 || widgets.length === 0) {
    return { positions, totalHeight: 0 };
  }

  const colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns;
  const columnHeights = new Array(maxColumns).fill(0);

  let visible = widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  if (options?.excludeIds) {
    visible = visible.filter((w) => !options.excludeIds!.has(w.id));
  }

  if (options?.phantom) {
    const phantomWidget: WidgetState = {
      id: options.phantom.id,
      type: "__phantom__",
      colSpan: options.phantom.colSpan,
      visible: true,
      order: options.phantom.order,
      ...(options.phantom.columnStart != null ? { columnStart: options.phantom.columnStart } : {}),
      ...(options.phantom.rowStart != null ? { rowStart: options.phantom.rowStart } : {}),
    };
    const insertIdx = visible.findIndex((w) => w.order > phantomWidget.order);
    if (insertIdx === -1) {
      visible.push(phantomWidget);
    } else {
      visible.splice(insertIdx, 0, phantomWidget);
    }
  }

  let currentRowStart: number | undefined;

  for (const widget of visible) {
    if (widget.rowStart != null && widget.rowStart !== currentRowStart) {
      const anyPlaced = columnHeights.some(h => h > 0);
      if (anyPlaced) {
        const maxH = Math.max(...columnHeights);
        for (let c = 0; c < maxColumns; c++) {
          columnHeights[c] = maxH;
        }
      }
      currentRowStart = widget.rowStart;
    }

    const span = Math.max(1, Math.min(widget.colSpan, maxColumns));
    const widgetWidth = span * colWidth + (span - 1) * gap;
    const widgetHeight =
      options?.phantom && widget.id === options.phantom.id
        ? options.phantom.height
        : (heights.get(widget.id) ?? DEFAULT_WIDGET_HEIGHT);

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
