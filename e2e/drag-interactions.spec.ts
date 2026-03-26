import { test, expect } from "./fixtures/dashboard.fixture";
import type { Page } from "@playwright/test";
import {
  widgetByLabel,
  widgetDragHandle,
  widgetResizeButton,
  columnButton,
  dropGhostByTestId,
  undoButton,
} from "./helpers/locators";
import {
  dragWidgetToWidget,
  dragWidgetToPosition,
  dragWidgetToGapBetween,
  startDragWithoutDrop,
  getWidgetCenter,
  getGapBeforeWidget,
  getGapAfterWidget,
  performMultiZoneDrag,
} from "./helpers/drag";
import {
  getWidgetStates,
  getGridState,
  getGhostState,
  expectWidgetOrder,
  expectSpacing,
  expectNoPositionJumps,
} from "./helpers/assertions";

// Default initial state in 3-col mode
const DEFAULT_WIDGETS = [
  { label: "Statistics", colSpan: 1 },
  { label: "Chart", colSpan: 2 },
  { label: "Notes", colSpan: 1 },
  { label: "Calendar", colSpan: 1 },
];

/** Assert full widget state: order, sizes, spacing, and widget count. */
async function expectFullState(
  page: Page,
  expected: Array<{ label: string; colSpan: number }>,
) {
  await expectWidgetOrder(page, expected);
  await expectSpacing(page);
  const grid = await getGridState(page);
  expect(grid.widgetCount).toBe(expected.length);
}

test.describe("Drag Interactions (3-column mode)", () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;
    await columnButton(page, 3).click();
    await page.waitForTimeout(400);
  });

  // ── Reorder via gap zones ──────────────────────────────────────

  test.describe("Reorder via gap zones", () => {
    test("drag to gap before first widget reorders to position 0", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const statsBox = await widgetByLabel(page, "Statistics").boundingBox();
      expect(statsBox).toBeTruthy();
      const gapPos = { x: statsBox!.x + statsBox!.width / 2, y: statsBox!.y + 4 };
      await dragWidgetToPosition(page, "Notes", gapPos.x, gapPos.y, { dwellMs: 150 });

      await expectFullState(page, [
        { label: "Notes", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Calendar", colSpan: 1 },
      ]);
    });

    test("drag to gap between same-row widgets reorders", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToGapBetween(page, "Calendar", "Statistics", "Chart");

      await expectFullState(page, [
        { label: "Statistics", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
      ]);
    });

    test("drag widget from row 2 to gap on row 1", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToGapBetween(page, "Calendar", "Statistics", "Chart");

      await expectFullState(page, [
        { label: "Statistics", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
      ]);
    });

    test("drag to gap after last widget reorders to end", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const gapPos = await getGapAfterWidget(page, "Calendar");
      await dragWidgetToPosition(page, "Statistics", gapPos.x, gapPos.y, { dwellMs: 150 });

      await expectFullState(page, [
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
      ]);
    });

    test("drag to gap between Notes and Calendar reorders", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToGapBetween(page, "Statistics", "Notes", "Calendar");

      await expectFullState(page, [
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
      ]);
    });
  });

  // ── Swap via widget zone dwell ─────────────────────────────────

  test.describe("Swap via widget zone dwell", () => {
    test("swap first and last widget", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Calendar", { dwellMs: 450 });

      await expectFullState(page, [
        { label: "Calendar", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
      ]);
    });

    test("swap adjacent widgets on same row", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Chart", { dwellMs: 450 });

      await expectFullState(page, [
        { label: "Chart", colSpan: 2 },
        { label: "Statistics", colSpan: 1 },
        { label: "Notes", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
      ]);
    });

    test("swap non-adjacent widgets", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Chart", "Calendar", { dwellMs: 450 });

      await expectFullState(page, [
        { label: "Statistics", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
        { label: "Notes", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
      ]);
    });

    test("swap 1-col onto 2-col preserves both colSpans", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Chart", { dwellMs: 450 });

      await expectFullState(page, [
        { label: "Chart", colSpan: 2 },
        { label: "Statistics", colSpan: 1 },
        { label: "Notes", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
      ]);
    });
  });

  // ── Auto-resize via long dwell ─────────────────────────────────

  test.describe("Auto-resize via long dwell", () => {
    test("1+1 (sum=2 ≤ 3): both keep original spans", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Notes", { dwellMs: 950 });

      const states = await getWidgetStates(page);
      const statsId = await getWidgetIdByLabel(page, "Statistics");
      const notesId = await getWidgetIdByLabel(page, "Notes");
      expect(states.find((s) => s.id === statsId)?.colSpan).toBe(1);
      expect(states.find((s) => s.id === notesId)?.colSpan).toBe(1);
      await expectSpacing(page);
      // State is committed — verify widget data is correct
    });

    test("1+2 (sum=3 ≤ 3): both keep original spans", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Chart", { dwellMs: 950 });

      const statsId = await getWidgetIdByLabel(page, "Statistics");
      const chartId = await getWidgetIdByLabel(page, "Chart");
      const states = await getWidgetStates(page);
      expect(states.find((s) => s.id === statsId)?.colSpan).toBe(1);
      expect(states.find((s) => s.id === chartId)?.colSpan).toBe(2);
      await expectSpacing(page);
    });

    test("2+1 (sum=3 ≤ 3): both keep original spans", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Chart", "Notes", { dwellMs: 950 });

      const chartId = await getWidgetIdByLabel(page, "Chart");
      const notesId = await getWidgetIdByLabel(page, "Notes");
      const states = await getWidgetStates(page);
      expect(states.find((s) => s.id === chartId)?.colSpan).toBe(2);
      expect(states.find((s) => s.id === notesId)?.colSpan).toBe(1);
      await expectSpacing(page);
    });

    test("2+2 (sum=4 > 3): both clamped to halfSpan=2", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await widgetResizeButton(page, "Statistics", 2).click();
      await page.waitForTimeout(300);

      await dragWidgetToWidget(page, "Statistics", "Chart", { dwellMs: 950 });

      const statsId = await getWidgetIdByLabel(page, "Statistics");
      const chartId = await getWidgetIdByLabel(page, "Chart");
      const states = await getWidgetStates(page);
      expect(states.find((s) => s.id === statsId)?.colSpan).toBe(2);
      expect(states.find((s) => s.id === chartId)?.colSpan).toBe(2);
      await expectSpacing(page);
    });

    test("3+1 (sum=4 > 3): both clamped to halfSpan=2", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await widgetResizeButton(page, "Chart", 3).click();
      await page.waitForTimeout(300);

      await dragWidgetToWidget(page, "Statistics", "Chart", { dwellMs: 950 });

      const statsId = await getWidgetIdByLabel(page, "Statistics");
      const chartId = await getWidgetIdByLabel(page, "Chart");
      const states = await getWidgetStates(page);
      expect(states.find((s) => s.id === statsId)?.colSpan).toBe(2);
      expect(states.find((s) => s.id === chartId)?.colSpan).toBe(2);
      await expectSpacing(page);
    });
  });

  // ── Dwell timing transitions ───────────────────────────────────

  test.describe("Dwell timing transitions", () => {
    test("short dwell: no order or size change", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Chart", { dwellMs: 0, steps: 5 });

      await expectFullState(page, DEFAULT_WIDGETS);
    });

    test("medium dwell triggers swap, sizes unchanged", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Notes", { dwellMs: 450 });

      await expectFullState(page, [
        { label: "Notes", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Statistics", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
      ]);
    });

    test("long dwell triggers auto-resize, sizes preserved for 1+1", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Notes", { dwellMs: 950 });

      // Order changed but all colSpans remain 1 since 1+1=2≤3
      const states = await getWidgetStates(page);
      for (const s of states) {
        if (s.id === (await getWidgetIdByLabel(page, "Chart"))) {
          expect(s.colSpan).toBe(2);
        } else {
          expect(s.colSpan).toBe(1);
        }
      }
      await expectSpacing(page);
      // State is committed — verify widget data is correct
    });
  });

  // ── Mid-drag state assertions ──────────────────────────────────

  test.describe("Mid-drag state", () => {
    test("during drag: non-dragged widgets maintain positions", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const before = await getWidgetStates(page);
      const statsId = await getWidgetIdByLabel(page, "Statistics");

      await startDragWithoutDrop(page, "Statistics", 0, 50);

      // Move toward Notes
      const notesCenter = await getWidgetCenter(page, "Notes");
      await page.mouse.move(notesCenter.x, notesCenter.y, { steps: 10 });
      await page.waitForTimeout(100); // Before dwell triggers intent

      // Non-dragged widgets should not have jumped
      const during = await getWidgetStates(page);
      expectNoPositionJumps(before, during, [statsId]);

      // The dragged widget should be flagged
      const dragged = during.find((w) => w.id === statsId);
      expect(dragged?.dragging).toBe(true);

      // Grid should be in dragging phase
      const grid = await getGridState(page);
      expect(grid.phase).toBe("dragging");

      // Clean up
      await page.mouse.move(-50, -50, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(350);
    });

    test("during drag: ghost has valid position and size when intent activates", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await startDragWithoutDrop(page, "Statistics", 0, 50);
      const notesCenter = await getWidgetCenter(page, "Notes");
      await page.mouse.move(notesCenter.x, notesCenter.y, { steps: 10 });
      await page.waitForTimeout(450); // Swap dwell

      // Ghost should be visible with valid dimensions
      const ghost = await getGhostState(page);
      expect(ghost).toBeTruthy();
      expect(ghost!.width).toBeGreaterThan(0);
      expect(ghost!.height).toBeGreaterThan(0);
      expect(ghost!.x).toBeGreaterThanOrEqual(0);
      expect(ghost!.y).toBeGreaterThanOrEqual(0);

      // Clean up
      await page.mouse.move(-50, -50, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(350);
    });

    test("during drag: phase transitions to dragging", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      // Initially idle
      expect((await getGridState(page)).phase).toBe("idle");

      await startDragWithoutDrop(page, "Statistics", 0, 50);

      // Should be dragging
      expect((await getGridState(page)).phase).toBe("dragging");

      // Clean up
      await page.mouse.move(-50, -50, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(350);
    });

    test("during multi-zone drag: positions stay stable between zones", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const statsId = await getWidgetIdByLabel(page, "Statistics");
      const before = await getWidgetStates(page);

      await startDragWithoutDrop(page, "Statistics", 0, 50);

      // Move to Chart (brief)
      const chartCenter = await getWidgetCenter(page, "Chart");
      await page.mouse.move(chartCenter.x, chartCenter.y, { steps: 10 });
      await page.waitForTimeout(100);

      const afterChart = await getWidgetStates(page);
      expectNoPositionJumps(before, afterChart, [statsId]);

      // Move to Calendar (brief)
      const calendarCenter = await getWidgetCenter(page, "Calendar");
      await page.mouse.move(calendarCenter.x, calendarCenter.y, { steps: 10 });
      await page.waitForTimeout(100);

      const afterCalendar = await getWidgetStates(page);
      expectNoPositionJumps(before, afterCalendar, [statsId]);

      // Clean up
      await page.mouse.move(-50, -50, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(350);

      // After cancel, everything back to original
      await expectFullState(page, DEFAULT_WIDGETS);
    });
  });

  // ── Keyboard drag in 3-col mode ────────────────────────────────

  test.describe("Keyboard drag in 3-col mode", () => {
    test("keyboard move reorders widget, sizes unchanged", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const handle = widgetDragHandle(page, "Statistics");
      await handle.focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Space");
      await page.waitForTimeout(350);

      const states = await getWidgetStates(page);
      // Statistics should have moved down from position 0
      const statsId = await getWidgetIdByLabel(page, "Statistics");
      expect(states[0].id).not.toBe(statsId);
      // All colSpans unchanged
      for (const s of states) {
        const expected = s.id === (await getWidgetIdByLabel(page, "Chart")) ? 2 : 1;
        expect(s.colSpan).toBe(expected);
      }
      await expectSpacing(page);
      // State is committed — verify widget data is correct
    });

    test("keyboard resize grows and shrinks colSpan, order unchanged", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const handle = widgetDragHandle(page, "Statistics");

      // Grow to 2
      await handle.focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Space");
      await page.waitForTimeout(350);

      await expectWidgetOrder(page, [
        { label: "Statistics", colSpan: 2 },
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
      ]);
      await expectSpacing(page);

      // Shrink back to 1
      await handle.focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Space");
      await page.waitForTimeout(350);

      await expectFullState(page, DEFAULT_WIDGETS);
    });
  });

  // ── Cursor movement between zones ──────────────────────────────

  test.describe("Cursor movement between zones", () => {
    test("widget→gap: reorder applied, sizes unchanged", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const chartCenter = await getWidgetCenter(page, "Chart");
      const gapAfter = await getGapAfterWidget(page, "Calendar");

      await performMultiZoneDrag(page, "Statistics", [
        { ...chartCenter, dwellMs: 100 },
        { ...gapAfter, dwellMs: 150 },
      ]);

      await expectFullState(page, [
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
      ]);
    });

    test("widget(swap dwell)→gap: reorder applied, not swap", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const notesCenter = await getWidgetCenter(page, "Notes");
      const gapAfter = await getGapAfterWidget(page, "Calendar");

      await performMultiZoneDrag(page, "Statistics", [
        { ...notesCenter, dwellMs: 450 },
        { ...gapAfter, dwellMs: 150 },
      ]);

      await expectFullState(page, [
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
      ]);
    });

    test("through multiple widgets: only final zone dwell counts", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const chartCenter = await getWidgetCenter(page, "Chart");
      const notesCenter = await getWidgetCenter(page, "Notes");
      const calendarCenter = await getWidgetCenter(page, "Calendar");

      await performMultiZoneDrag(page, "Statistics", [
        { ...chartCenter, dwellMs: 100 },
        { ...notesCenter, dwellMs: 100 },
        { ...calendarCenter, dwellMs: 450 },
      ]);

      await expectFullState(page, [
        { label: "Calendar", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
      ]);
    });

    test("widget→outside: no order or size change", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const notesCenter = await getWidgetCenter(page, "Notes");
      await performMultiZoneDrag(page, "Statistics", [
        { ...notesCenter, dwellMs: 450 },
        { x: -50, y: -50, dwellMs: 100 },
      ]);

      await expectFullState(page, DEFAULT_WIDGETS);
    });
  });

  // ── Cancellation ───────────────────────────────────────────────

  test.describe("Cancellation", () => {
    test("cancel after swap dwell: no state change", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const notesCenter = await getWidgetCenter(page, "Notes");
      await performMultiZoneDrag(page, "Statistics", [
        { ...notesCenter, dwellMs: 450 },
        { x: -50, y: -50, dwellMs: 150 },
      ]);

      await expectFullState(page, DEFAULT_WIDGETS);
    });

    test("cancel after auto-resize dwell: sizes preserved", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      const chartCenter = await getWidgetCenter(page, "Chart");
      await performMultiZoneDrag(page, "Statistics", [
        { ...chartCenter, dwellMs: 950 },
        { x: -50, y: -50, dwellMs: 150 },
      ]);

      await expectFullState(page, DEFAULT_WIDGETS);
    });

    test("mouse release outside grid: no state change", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await startDragWithoutDrop(page, "Statistics", 0, 50);
      await page.mouse.move(-50, -50, { steps: 10 });
      await page.waitForTimeout(200);
      await page.mouse.up();
      await page.waitForTimeout(350);

      await expectFullState(page, DEFAULT_WIDGETS);
    });
  });

  // ── Drop ghost ─────────────────────────────────────────────────

  test.describe("Drop ghost", () => {
    test("ghost visible with valid dimensions during swap intent", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await startDragWithoutDrop(page, "Statistics", 0, 50);
      const notesCenter = await getWidgetCenter(page, "Notes");
      await page.mouse.move(notesCenter.x, notesCenter.y, { steps: 10 });
      await page.waitForTimeout(450);

      await expect(dropGhostByTestId(page)).toBeVisible();
      const ghost = await getGhostState(page);
      expect(ghost).toBeTruthy();
      expect(ghost!.width).toBeGreaterThan(0);
      expect(ghost!.height).toBeGreaterThan(0);

      await page.mouse.move(-50, -50, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(350);
    });

    test("ghost disappears after drop, final state correct", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Notes", { dwellMs: 450 });

      await expect(dropGhostByTestId(page)).not.toBeVisible();
      await expectFullState(page, [
        { label: "Notes", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Statistics", colSpan: 1 },
        { label: "Calendar", colSpan: 1 },
      ]);
    });
  });

  // ── Undo after drag operations ─────────────────────────────────

  test.describe("Undo after drag operations", () => {
    test("undo after swap restores original order and sizes", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await dragWidgetToWidget(page, "Statistics", "Calendar", { dwellMs: 450 });

      await expectFullState(page, [
        { label: "Calendar", colSpan: 1 },
        { label: "Chart", colSpan: 2 },
        { label: "Notes", colSpan: 1 },
        { label: "Statistics", colSpan: 1 },
      ]);

      await undoButton(page).click();
      await page.waitForTimeout(300);

      await expectFullState(page, DEFAULT_WIDGETS);
    });

    test("undo after auto-resize restores sizes", async ({ dashboardPage }) => {
      const page = dashboardPage.page;

      await widgetResizeButton(page, "Statistics", 2).click();
      await page.waitForTimeout(300);

      await dragWidgetToWidget(page, "Statistics", "Chart", { dwellMs: 950 });

      // Undo auto-resize
      await undoButton(page).click();
      await page.waitForTimeout(300);
      const statsId = await getWidgetIdByLabel(page, "Statistics");
      const chartId = await getWidgetIdByLabel(page, "Chart");
      const states = await getWidgetStates(page);
      expect(states.find((s) => s.id === statsId)?.colSpan).toBe(2);
      expect(states.find((s) => s.id === chartId)?.colSpan).toBe(2);

      // Undo manual resize
      await undoButton(page).click();
      await page.waitForTimeout(300);

      await expectFullState(page, DEFAULT_WIDGETS);
    });
  });
});

// ── Helper ───────────────────────────────────────────────────────

async function getWidgetIdByLabel(page: Page, label: string): Promise<string> {
  const id = await page
    .locator("[data-widget-id]")
    .filter({ has: page.locator(".dash-label-emphasis", { hasText: label }) })
    .getAttribute("data-widget-id");
  if (!id) throw new Error(`Widget "${label}" not found`);
  return id;
}
