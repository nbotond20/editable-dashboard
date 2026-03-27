import { test, expect } from "./fixtures/dashboard.fixture";
import type { Page } from "@playwright/test";
import {
  widgetByLabel,
  widgetDragHandle,
  widgetResizeButton,
  columnButton,
} from "./helpers/locators";
import {
  dragWidgetToWidget,
} from "./helpers/drag";
import {
  getWidgetStates,
  expectWidgetOrder,
  expectSpacing,
} from "./helpers/assertions";

/**
 * Focused test: drag a 1-col widget onto another 1-col widget in a 2x2 grid.
 *
 * Setup (2-col mode, all 1-column widgets after resizing Chart):
 *   Statistics | Chart
 *   Notes      | Calendar
 *
 * Scenario: drag Notes onto Statistics (swap dwell = 300ms).
 *
 * Expected: Notes and Statistics swap, everything else stays put:
 *   Notes      | Chart
 *   Statistics | Calendar
 *
 * Bug being tested: the drag currently produces TWO different layout
 * changes — first a reorder (when pointer crosses gap zones on the way
 * to the target), then a swap (when dwell exceeds 300ms). The user
 * should only see ONE swap.
 */
test.describe("Swap: drag widget onto widget in 2x2 grid", () => {
  async function setupGrid(page: Page) {
    await columnButton(page, 2).click();
    await page.waitForTimeout(300);

    // Resize Chart from 2-col → 1-col to get a clean 2x2 grid
    await widgetResizeButton(page, "Chart", 1).click();
    await page.waitForTimeout(300);
  }

  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await setupGrid(dashboardPage.page);
  });

  test("swap only exchanges the two widgets, Chart and Calendar stay put", async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;

    // Verify initial 2x2 layout
    await expectWidgetOrder(page, [
      { label: "Statistics", colSpan: 1 },
      { label: "Chart", colSpan: 1 },
      { label: "Notes", colSpan: 1 },
      { label: "Calendar", colSpan: 1 },
    ]);

    // Record positions of the two uninvolved widgets
    const before = await getWidgetStates(page);
    const chartBefore = before.find((w) => w.order === 1)!;
    const calBefore = before.find((w) => w.order === 3)!;

    // Drag Notes onto Statistics — hold for swap (450ms > 300ms threshold)
    // but NOT for auto-resize (< 800ms threshold)
    await dragWidgetToWidget(page, "Notes", "Statistics", {
      dwellMs: 450,
      steps: 20,
    });

    // Notes and Statistics should have swapped
    await expectWidgetOrder(page, [
      { label: "Notes", colSpan: 1 },
      { label: "Chart", colSpan: 1 },
      { label: "Statistics", colSpan: 1 },
      { label: "Calendar", colSpan: 1 },
    ]);
    await expectSpacing(page);

    // Chart and Calendar should not have moved
    const after = await getWidgetStates(page);
    const chartAfter = after.find((w) => w.id === chartBefore.id)!;
    const calAfter = after.find((w) => w.id === calBefore.id)!;

    expect(
      Math.abs(chartAfter.x - chartBefore.x),
      `Chart x-position shifted from ${chartBefore.x} to ${chartAfter.x}`,
    ).toBeLessThan(5);
    expect(
      Math.abs(chartAfter.y - chartBefore.y),
      `Chart y-position shifted from ${chartBefore.y} to ${chartAfter.y}`,
    ).toBeLessThan(5);
    expect(
      Math.abs(calAfter.x - calBefore.x),
      `Calendar x-position shifted from ${calBefore.x} to ${calAfter.x}`,
    ).toBeLessThan(5);
    expect(
      Math.abs(calAfter.y - calBefore.y),
      `Calendar y-position shifted from ${calBefore.y} to ${calAfter.y}`,
    ).toBeLessThan(5);
  });

  test("holding past 800ms should not change the result compared to a swap", async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;

    // Drag with long dwell (>800ms auto-resize threshold)
    await dragWidgetToWidget(page, "Notes", "Statistics", {
      dwellMs: 1000,
      steps: 20,
    });

    // Should still be 4 widgets, all 1-col (auto-resize should not
    // change spans when both widgets already fit in the grid)
    const after = await getWidgetStates(page);
    for (const w of after) {
      expect(w.colSpan, `Widget ${w.id} colSpan changed`).toBe(1);
    }
    await expectSpacing(page);
  });

  test("there should be only ONE layout transition, not two", async ({
    dashboardPage,
  }) => {
    const page = dashboardPage.page;

    // Record initial order
    const before = await getWidgetStates(page);

    const handle = widgetDragHandle(page, "Notes");
    const target = widgetByLabel(page, "Statistics");
    const handleBox = await handle.boundingBox();
    const targetBox = await target.boundingBox();
    if (!handleBox || !targetBox) throw new Error("Missing bounding box");

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const endX = targetBox.x + targetBox.width / 2;
    const endY = targetBox.y + targetBox.height / 2;

    // Start drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Move to target in steps
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(
        startX + (endX - startX) * (i / 20),
        startY + (endY - startY) * (i / 20),
      );
    }

    // Wait just past the swap threshold (300ms + buffer for debounce)
    await page.waitForTimeout(450);

    // Snapshot the preview layout while still dragging
    const duringSwap = await getWidgetStates(page);
    const nonDraggedSwap = duringSwap.filter((w) => !w.dragging);

    // Continue holding until well past the auto-resize threshold (800ms)
    await page.waitForTimeout(600);

    // Snapshot again
    const duringResize = await getWidgetStates(page);
    const nonDraggedResize = duringResize.filter((w) => !w.dragging);

    // The non-dragged widgets should be in the SAME positions at both
    // snapshots — there should not be a second layout change.
    expect(nonDraggedSwap.length).toBe(nonDraggedResize.length);
    for (const ws of nonDraggedSwap) {
      const wr = nonDraggedResize.find((w) => w.id === ws.id);
      expect(wr, `Widget ${ws.id} disappeared`).toBeTruthy();
      expect(
        Math.abs(wr!.x - ws.x),
        `Widget ${ws.id} x changed between swap and resize phase`,
      ).toBeLessThan(5);
      expect(
        Math.abs(wr!.y - ws.y),
        `Widget ${ws.id} y changed between swap and resize phase`,
      ).toBeLessThan(5);
    }

    // Drop
    await page.mouse.up();
    await page.waitForTimeout(350);
  });
});
