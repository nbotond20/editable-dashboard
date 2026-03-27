import { expect, type Page } from "@playwright/test";

export interface WidgetLayoutInfo {
  id: string;
  order: number;
  colSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Logical row index (0-based, derived from pixel position). */
  row: number;
  /** Logical column index (0-based, derived from pixel position). */
  col: number;
}

/**
 * Read every widget's data-* attributes and compute logical row/col positions.
 * Returns widgets sorted by visual position (top-to-bottom, left-to-right).
 */
export async function getWidgetLayoutInfo(page: Page): Promise<WidgetLayoutInfo[]> {
  const raw = await page.$$eval("[data-widget-id]", (elements) =>
    elements.map((el) => {
      const d = (el as HTMLElement).dataset;
      return {
        id: d.widgetId!,
        order: Number(d.widgetOrder),
        colSpan: Number(d.colspan),
        x: Number(d.x),
        y: Number(d.y),
        width: Number(d.width),
        height: Number(d.height),
      };
    }),
  );

  const gridState = await page.$eval('[data-testid="dashboard-grid"]', (el) => {
    const d = (el as HTMLElement).dataset;
    return {
      gap: Number(d.gap),
      maxColumns: Number(d.maxColumns),
    };
  });

  const { gap, maxColumns } = gridState;

  // Sort by y then x to get visual order
  raw.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 5) return a.y - b.y;
    return a.x - b.x;
  });

  // Compute logical columns from pixel positions.
  const containerWidth = await page.$eval(
    '[data-testid="dashboard-grid"]',
    (el) => (el as HTMLElement).offsetWidth,
  );
  const colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns;

  // Assign logical rows using column-based tracking.
  // This handles variable widget heights correctly: instead of grouping by
  // y-tolerance (which breaks when widgets have different heights), we track
  // the next available row per column and assign each widget to the highest
  // needed row across its spanned columns.
  const nextRowForCol = new Array(maxColumns).fill(0);

  return raw.map((w) => {
    const col = Math.round(w.x / (colWidth + gap));
    const span = w.colSpan;

    // Row = max of next-available-row across all columns this widget occupies
    let row = 0;
    for (let c = col; c < col + span && c < maxColumns; c++) {
      row = Math.max(row, nextRowForCol[c]);
    }

    // Advance next-available-row for all occupied columns
    for (let c = col; c < col + span && c < maxColumns; c++) {
      nextRowForCol[c] = row + 1;
    }

    return { ...w, row, col };
  });
}

/**
 * Build a 2D grid representation from the current layout.
 *
 * Each cell contains the widget ID occupying it, or `null` for empty cells.
 * Multi-span widgets have their ID repeated across occupied columns.
 *
 * Example for "A A B / C":
 *   [["a", "a", "b"], ["c", null, null]]
 */
export async function getGridRepresentation(
  page: Page,
): Promise<(string | null)[][]> {
  const widgets = await getWidgetLayoutInfo(page);

  if (widgets.length === 0) return [];

  const maxRow = Math.max(...widgets.map((w) => w.row));
  const gridState = await page.$eval('[data-testid="dashboard-grid"]', (el) => {
    return Number((el as HTMLElement).dataset.maxColumns);
  });

  const grid: (string | null)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    grid.push(new Array(gridState).fill(null));
  }

  for (const w of widgets) {
    for (let c = 0; c < w.colSpan; c++) {
      if (w.col + c < gridState) {
        grid[w.row][w.col + c] = w.id;
      }
    }
  }

  return grid;
}

/**
 * Find empty cells in the current grid.
 */
export async function getEmptyCells(
  page: Page,
): Promise<{ row: number; col: number }[]> {
  const grid = await getGridRepresentation(page);
  const empty: { row: number; col: number }[] = [];

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === null) {
        empty.push({ row: r, col: c });
      }
    }
  }

  return empty;
}

/**
 * Assert the current grid layout matches the expected representation.
 *
 * `expected` uses the same format as getGridRepresentation:
 *   [["a","b","c"], ["d"]]   means row0=[a,b,c], row1=[d,null,null]
 *
 * Short rows are padded with null to maxColumns width.
 */
export async function assertLayout(
  page: Page,
  expected: (string | null)[][],
) {
  // Wait briefly for any layout animations to settle
  await page.waitForTimeout(200);

  const actual = await getGridRepresentation(page);

  const gridState = await page.$eval('[data-testid="dashboard-grid"]', (el) => {
    return Number((el as HTMLElement).dataset.maxColumns);
  });

  // Pad expected rows to maxColumns
  const padded = expected.map((row) => {
    const r = [...row];
    while (r.length < gridState) r.push(null);
    return r;
  });

  expect(
    actual.length,
    `Expected ${padded.length} rows, got ${actual.length}.\nActual grid: ${JSON.stringify(actual)}\nExpected grid: ${JSON.stringify(padded)}`,
  ).toBe(padded.length);

  for (let r = 0; r < padded.length; r++) {
    expect(
      actual[r],
      `Row ${r} mismatch.\nActual grid: ${JSON.stringify(actual)}\nExpected grid: ${JSON.stringify(padded)}`,
    ).toEqual(padded[r]);
  }
}

/**
 * Assert widget visual order matches expected ID sequence.
 */
export async function assertWidgetOrder(page: Page, expectedIds: string[]) {
  const widgets = await getWidgetLayoutInfo(page);
  const actualIds = widgets.map((w) => w.id);
  expect(actualIds).toEqual(expectedIds);
}

/**
 * Get all widget colSpans as a map of id → colSpan.
 */
export async function getWidgetColSpans(
  page: Page,
): Promise<Record<string, number>> {
  const widgets = await getWidgetLayoutInfo(page);
  const result: Record<string, number> = {};
  for (const w of widgets) {
    result[w.id] = w.colSpan;
  }
  return result;
}

/**
 * Capture the preview grid during an active drag.
 *
 * During drag, non-dragged widgets have their data-x/y set from the
 * previewLayout (target positions). The dragged widget's target position
 * is shown by the ghost element. This function combines both to produce
 * the grid the user sees as the "preview" — which should match the final
 * layout after the drop.
 *
 * Returns null if no preview is available (no ghost element visible).
 */
export async function capturePreviewGrid(
  page: Page,
): Promise<(string | null)[][] | null> {
  const ghostEl = page.locator('[data-testid="drop-ghost"]');
  if ((await ghostEl.count()) === 0) return null;

  const gridState = await page.$eval('[data-testid="dashboard-grid"]', (el) => {
    const d = (el as HTMLElement).dataset;
    return {
      gap: Number(d.gap),
      maxColumns: Number(d.maxColumns),
    };
  });
  const { gap, maxColumns } = gridState;

  const containerWidth = await page.$eval(
    '[data-testid="dashboard-grid"]',
    (el) => (el as HTMLElement).offsetWidth,
  );
  const colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns;
  const step = colWidth + gap;

  // Read non-dragged widgets — use data-width to derive colSpan since
  // the preview layout may resize widgets without updating data-colspan.
  const nonDragged = await page.$$eval("[data-widget-id]", (elements) =>
    elements
      .filter((el) => (el as HTMLElement).dataset.dragging !== "true")
      .map((el) => {
        const d = (el as HTMLElement).dataset;
        return {
          id: d.widgetId!,
          width: Number(d.width),
          x: Number(d.x),
          y: Number(d.y),
        };
      }),
  );

  // Read ghost position + width (represents the dragged widget's target)
  const ghostData = await ghostEl.evaluate((el) => ({
    x: Number((el as HTMLElement).dataset.ghostX),
    y: Number((el as HTMLElement).dataset.ghostY),
    width: Number((el as HTMLElement).dataset.ghostWidth),
  }));

  // Read dragged widget ID
  const draggedInfo = await page.$$eval("[data-widget-id]", (elements) => {
    const el = elements.find((e) => (e as HTMLElement).dataset.dragging === "true");
    if (!el) return null;
    return { id: (el as HTMLElement).dataset.widgetId! };
  });

  // Derive colSpan from pixel width: span = round((width + gap) / (colWidth + gap))
  const deriveSpan = (width: number) =>
    Math.max(1, Math.round((width + gap) / step));

  // Combine: non-dragged at their preview positions + dragged at ghost position
  type Entry = { id: string; colSpan: number; x: number; y: number };
  const all: Entry[] = nonDragged.map((w) => ({
    ...w,
    colSpan: deriveSpan(w.width),
  }));
  if (draggedInfo) {
    all.push({
      id: draggedInfo.id,
      colSpan: deriveSpan(ghostData.width),
      x: ghostData.x,
      y: ghostData.y,
    });
  }

  // Sort by y then x (same as getWidgetLayoutInfo)
  all.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 5) return a.y - b.y;
    return a.x - b.x;
  });

  // Compute logical rows/cols and build grid (same algorithm as getGridRepresentation)
  const nextRowForCol = new Array(maxColumns).fill(0);
  const positioned = all.map((w) => {
    const col = Math.round(w.x / step);
    const span = Math.max(1, Math.min(w.colSpan, maxColumns));
    let row = 0;
    for (let c = col; c < col + span && c < maxColumns; c++) {
      row = Math.max(row, nextRowForCol[c]);
    }
    for (let c = col; c < col + span && c < maxColumns; c++) {
      nextRowForCol[c] = row + 1;
    }
    return { id: w.id, col, row, colSpan: span };
  });

  if (positioned.length === 0) return null;

  const maxRow = Math.max(...positioned.map((w) => w.row));
  const grid: (string | null)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    grid.push(new Array(maxColumns).fill(null));
  }
  for (const w of positioned) {
    for (let c = 0; c < w.colSpan; c++) {
      if (w.col + c < maxColumns) {
        grid[w.row][w.col + c] = w.id;
      }
    }
  }

  return grid;
}
