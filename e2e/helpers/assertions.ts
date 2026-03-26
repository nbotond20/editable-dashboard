import { expect, type Page } from "@playwright/test";

export interface WidgetTestState {
  id: string;
  order: number;
  colSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dragging: boolean;
}

export interface GridTestState {
  phase: string;
  maxColumns: number;
  gap: number;
  widgetCount: number;
}

export interface GhostTestState {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Read all widget states from data-* attributes, sorted by order. */
export async function getWidgetStates(page: Page): Promise<WidgetTestState[]> {
  const states = await page.$$eval("[data-widget-id]", (elements) =>
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
        dragging: d.dragging === "true",
      };
    }),
  );
  return states.sort((a, b) => a.order - b.order);
}

/** Read grid container state from data-* attributes. */
export async function getGridState(page: Page): Promise<GridTestState> {
  return page.$eval('[data-testid="dashboard-grid"]', (el) => {
    const d = (el as HTMLElement).dataset;
    return {
      phase: d.phase!,
      maxColumns: Number(d.maxColumns),
      gap: Number(d.gap),
      widgetCount: Number(d.widgetCount),
    };
  });
}

/** Read ghost position/size from data-* attributes. Returns null if ghost not visible. */
export async function getGhostState(page: Page): Promise<GhostTestState | null> {
  const ghost = page.locator('[data-testid="drop-ghost"]');
  if (!(await ghost.isVisible())) return null;
  return ghost.evaluate((el) => {
    const d = (el as HTMLElement).dataset;
    return {
      x: Number(d.ghostX),
      y: Number(d.ghostY),
      width: Number(d.ghostWidth),
      height: Number(d.ghostHeight),
    };
  });
}

/** Assert that the widget order (by label) and colSpans match expectations. */
export async function expectWidgetOrder(
  page: Page,
  expected: Array<{ label: string; colSpan: number }>,
) {
  const states = await getWidgetStates(page);
  expect(states).toHaveLength(expected.length);

  // Get labels in order — target the header label specifically (first .dash-label-emphasis in .dash-widget__header)
  for (let i = 0; i < expected.length; i++) {
    const widget = states[i];
    const label = await page
      .locator(`[data-widget-id="${widget.id}"] .dash-widget__header .dash-label-emphasis`)
      .first()
      .textContent();
    expect(label, `Widget at position ${i}`).toBe(expected[i].label);
    expect(widget.colSpan, `colSpan of ${expected[i].label}`).toBe(expected[i].colSpan);
  }
}

/**
 * Verify no widgets overlap and all have positive dimensions.
 * Exact gap sizes are validated by the layout engine's unit tests.
 */
export async function expectSpacing(page: Page) {
  const states = await getWidgetStates(page);
  if (states.length < 2) return;

  // Check no overlaps between any pair of widgets
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const a = states[i];
      const b = states[j];
      const overlapX = a.x < b.x + b.width && b.x < a.x + a.width;
      const overlapY = a.y < b.y + b.height && b.y < a.y + a.height;
      expect(
        overlapX && overlapY,
        `Widgets at order ${a.order} and ${b.order} overlap`,
      ).toBe(false);
    }
  }

  // All widgets should have positive dimensions
  for (const w of states) {
    expect(w.width, `Widget ${w.id} width`).toBeGreaterThan(0);
    expect(w.height, `Widget ${w.id} height`).toBeGreaterThan(0);
  }
}

/**
 * Assert non-dragged widgets haven't jumped positions.
 * Compares before and after states, excluding specified widget IDs.
 */
export function expectNoPositionJumps(
  before: WidgetTestState[],
  after: WidgetTestState[],
  excludeIds: string[],
  tolerance = 5,
) {
  const stableBefore = before.filter((w) => !excludeIds.includes(w.id));
  for (const orig of stableBefore) {
    const current = after.find((w) => w.id === orig.id);
    expect(current, `Widget ${orig.id} should still exist`).toBeTruthy();
    expect(
      Math.abs(current!.x - orig.x),
      `Widget ${orig.id} x-position jumped from ${orig.x} to ${current!.x}`,
    ).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(current!.y - orig.y),
      `Widget ${orig.id} y-position jumped from ${orig.y} to ${current!.y}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}
