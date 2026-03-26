import { test, expect } from "./fixtures/dashboard.fixture";
import { columnButton } from "./helpers/locators";
import {
  touchStartDrag,
  touchMove,
  touchEnd,
  touchDragToWidget,
  touchDragCancel,
  getWidgetCenter,
} from "./helpers/drag";
import {
  getWidgetStates,
  getGridState,
  expectWidgetOrder,
  expectSpacing,
} from "./helpers/assertions";

const DEFAULT_WIDGETS = [
  { label: "Statistics", colSpan: 1 },
  { label: "Chart", colSpan: 2 },
  { label: "Notes", colSpan: 1 },
  { label: "Calendar", colSpan: 1 },
];

test.describe("Touch Drag Interactions (3-column mode)", () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;
    await columnButton(page, 3).click();
    await page.waitForTimeout(400);
  });

  test("touch long-press activates drag after 200ms", async ({ dashboardPage }) => {
    const page = dashboardPage.page;

    const start = await touchStartDrag(page, "Statistics");

    // Wait past the 200ms touch activation delay + buffer
    await page.waitForTimeout(300);

    const grid = await getGridState(page);
    expect(grid.phase).toBe("dragging");

    // Verify Statistics is flagged as dragging
    const states = await getWidgetStates(page);
    const dragging = states.find((s) => s.dragging);
    expect(dragging).toBeTruthy();

    // Clean up
    await touchEnd(page, start.x, start.y);
    await page.waitForTimeout(350);
  });

  test("touch move >10px during long-press cancels drag (scroll intent)", async ({ dashboardPage }) => {
    const page = dashboardPage.page;

    // Move 15px within 200ms — exceeds TOUCH_MOVE_TOLERANCE (10px)
    await touchDragCancel(page, "Statistics", 15);

    // Should be back to idle, no drag activated
    const grid = await getGridState(page);
    expect(grid.phase).toBe("idle");

    // No widget should be dragging
    const states = await getWidgetStates(page);
    expect(states.every((s) => !s.dragging)).toBe(true);

    // Order unchanged
    await expectWidgetOrder(page, DEFAULT_WIDGETS);
  });

  test("touch move <10px during long-press does NOT cancel", async ({ dashboardPage }) => {
    const page = dashboardPage.page;

    const start = await touchStartDrag(page, "Statistics");

    // Move only 5px — below TOUCH_MOVE_TOLERANCE
    await touchMove(page, start.x + 3, start.y + 3);
    await page.waitForTimeout(50);
    await touchMove(page, start.x + 5, start.y);

    // Wait past activation delay
    await page.waitForTimeout(300);

    // Should still be dragging (not cancelled)
    const grid = await getGridState(page);
    expect(grid.phase).toBe("dragging");

    // Clean up
    await touchEnd(page, start.x + 5, start.y);
    await page.waitForTimeout(350);
  });

  test("touch drag swap with dwell on target widget", async ({ dashboardPage }) => {
    const page = dashboardPage.page;

    // Full touch drag: Statistics onto Notes with 450ms dwell (swap)
    await touchDragToWidget(page, "Statistics", "Notes", { dwellMs: 450 });

    await expectWidgetOrder(page, [
      { label: "Notes", colSpan: 1 },
      { label: "Chart", colSpan: 2 },
      { label: "Statistics", colSpan: 1 },
      { label: "Calendar", colSpan: 1 },
    ]);
    await expectSpacing(page);
    expect((await getGridState(page)).phase).toBe("idle");
  });

  test("touch drag auto-resize with long dwell", async ({ dashboardPage }) => {
    const page = dashboardPage.page;

    // Touch drag: Statistics(1) onto Chart(2) with 950ms dwell (auto-resize)
    await touchDragToWidget(page, "Statistics", "Chart", { dwellMs: 950 });

    // 1+2=3 ≤ 3, both keep original spans
    const states = await getWidgetStates(page);
    const statsState = states.find((s) => !s.dragging && s.colSpan === 1);
    const chartState = states.find((s) => s.colSpan === 2);
    expect(statsState).toBeTruthy();
    expect(chartState).toBeTruthy();
    await expectSpacing(page);
    expect((await getGridState(page)).phase).toBe("idle");
  });

  test("touch drag reorder to gap", async ({ dashboardPage }) => {
    const page = dashboardPage.page;

    const start = await touchStartDrag(page, "Statistics");

    // Wait for activation
    await page.waitForTimeout(250);

    // Get gap position after Calendar
    const calendarCenter = await getWidgetCenter(page, "Calendar");
    const calBox = await page.locator("[data-widget-id]").filter({
      has: page.locator(".dash-label-emphasis", { hasText: "Calendar" }),
    }).boundingBox();
    expect(calBox).toBeTruthy();
    const gapX = calBox!.x + calBox!.width + 4;
    const gapY = calBox!.y + calBox!.height / 2;

    // Move to gap in steps
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      await touchMove(
        page,
        start.x + (gapX - start.x) * progress,
        start.y + (gapY - start.y) * progress,
      );
    }

    await page.waitForTimeout(200);
    await touchEnd(page, gapX, gapY);
    await page.waitForTimeout(350);

    await expectWidgetOrder(page, [
      { label: "Chart", colSpan: 2 },
      { label: "Notes", colSpan: 1 },
      { label: "Calendar", colSpan: 1 },
      { label: "Statistics", colSpan: 1 },
    ]);
    await expectSpacing(page);
  });
});
