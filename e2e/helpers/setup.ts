import type { Page } from "@playwright/test";

const STORAGE_KEY = "editable-dashboard-state";

const WIDGET_TYPES = ["stats", "chart", "notes", "calendar", "table"];

export interface TestWidget {
  id: string;
  colSpan: number;
  order: number;
  type: string;
  columnStart?: number;
}

export interface TestConfig {
  widgets: TestWidget[];
  maxColumns: number;
}

/**
 * Parse the test-case notation into a TestConfig.
 *
 * Notation rules:
 *   - Each string is one row of the grid.
 *   - Tokens are separated by spaces.
 *   - A letter repeated N times in a row (e.g. "A A") means that widget
 *     has colSpan N.
 *   - "x" marks an empty cell (not a widget).
 *   - maxColumns is the length of the longest row.
 *   - Widgets in rows containing "x" get `columnStart` set to their
 *     actual column position so the layout engine places them correctly.
 *
 * Example: ["A B C", "x D"] →
 *   maxColumns: 3,
 *   widgets: [
 *     { id: "a", colSpan: 1, order: 0, type: "stats" },
 *     { id: "b", colSpan: 1, order: 1, type: "chart" },
 *     { id: "c", colSpan: 1, order: 2, type: "notes" },
 *     { id: "d", colSpan: 1, order: 3, type: "calendar", columnStart: 1 },
 *   ]
 */
export function parseNotation(lines: string[]): TestConfig {
  const seen = new Map<string, { colSpan: number; columnStart?: number }>();
  const orderList: string[] = []; // preserves first-seen order
  let maxColumns = 0;

  let needsColumnStart = false;

  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    maxColumns = Math.max(maxColumns, tokens.length);

    const hasEmpty = tokens.some((t) => t.toUpperCase() === "X");
    if (hasEmpty) needsColumnStart = true;

    // Pin widgets on lines with a single widget that don't fill maxColumns,
    // so each notation line maps to a distinct visual row.
    const distinctWidgets = new Set(
      tokens.filter((t) => t.toUpperCase() !== "X").map((t) => t.toUpperCase()),
    );
    const isSingleWidgetLine = distinctWidgets.size === 1 && tokens.length < maxColumns;

    let colPos = 0;
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i].toUpperCase();
      if (token === "X") {
        colPos++;
        i++;
        continue;
      }

      // Count consecutive identical letters
      let span = 1;
      while (i + span < tokens.length && tokens[i + span].toUpperCase() === token) {
        span++;
      }

      const id = token.toLowerCase();
      if (!seen.has(id)) {
        const entry: { colSpan: number; columnStart?: number } = { colSpan: span };
        if (needsColumnStart || isSingleWidgetLine) {
          entry.columnStart = colPos;
        }
        seen.set(id, entry);
        orderList.push(id);
      }

      colPos += span;
      i += span;
    }
  }

  let typeIdx = 0;
  const widgets: TestWidget[] = orderList.map((id, order) => {
    const entry = seen.get(id)!;
    const w: TestWidget = {
      id,
      colSpan: entry.colSpan,
      order,
      type: WIDGET_TYPES[typeIdx++ % WIDGET_TYPES.length],
    };
    if (entry.columnStart !== undefined) {
      w.columnStart = entry.columnStart;
    }
    return w;
  });

  return { widgets, maxColumns };
}

/**
 * Build a localStorage-compatible serialized dashboard state.
 */
export function buildSeedState(config: TestConfig) {
  return {
    version: 1,
    widgets: config.widgets.map((w) => {
      const widget: Record<string, unknown> = {
        id: w.id,
        type: w.type,
        colSpan: w.colSpan,
        visible: true,
        order: w.order,
      };
      if (w.columnStart !== undefined) {
        widget.columnStart = w.columnStart;
      }
      return widget;
    }),
    maxColumns: config.maxColumns,
    gap: 16,
  };
}

/**
 * Seed the dashboard with a specific widget configuration and navigate.
 *
 * Call this at the start of each test. It injects state into localStorage
 * via addInitScript (runs before page JS), then navigates and waits for
 * widgets to render.
 *
 * Also:
 *   - Clicks the column button if maxColumns differs from the default (2).
 */
export async function setupDashboard(
  page: Page,
  lines: string[],
  maxColumnsOverride?: number,
): Promise<TestConfig> {
  const config = parseNotation(lines);
  if (maxColumnsOverride !== undefined) {
    config.maxColumns = maxColumnsOverride;
  }
  const state = buildSeedState(config);

  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: state },
  );

  await page.goto("/");
  await page.locator("[data-widget-id]").first().waitFor();

  // The app defaults to maxColumns=2 (ignores localStorage maxColumns).
  // Click the column button to switch if needed.
  if (config.maxColumns !== 2) {
    const colText = config.maxColumns === 1 ? "1 col" : `${config.maxColumns} cols`;
    await page.locator(".dash-header").getByRole("button", { name: colText, exact: true }).click();
  }

  // Wait for layout to settle after CSS + column change
  await page.waitForTimeout(500);

  return config;
}
