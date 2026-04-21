import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout } from "./helpers/layout-utils";
import { widgetById, widgetDragHandleById } from "./helpers/locators";
import { humanizePath } from "./helpers/humanize-path";

/**
 * Drag a widget by grabbing its drag handle at a specific fractional offset
 * (0,0 = top-left, 1,1 = bottom-right of the handle).
 *
 * This tests that zone resolution is independent of where the user grabs —
 * the engine should use the dragged widget's visual center, not the raw cursor.
 */
async function dragWithGrabOffset(
  page: Page,
  sourceId: string,
  grabFraction: { x: number; y: number },
  targetX: number,
  targetY: number,
  options?: { dwellMs?: number },
) {
  const handle = widgetDragHandleById(page, sourceId);
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error(`Drag handle for "${sourceId}" not found`);

  const startX = handleBox.x + handleBox.width * grabFraction.x;
  const startY = handleBox.y + handleBox.height * grabFraction.y;
  const dwellMs = options?.dwellMs ?? 500;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const points = humanizePath(startX, startY, targetX, targetY);
  for (const pt of points) {
    await page.mouse.move(pt.x, pt.y);
    if (pt.pauseMs) await page.waitForTimeout(pt.pauseMs);
  }

  const startTime = Date.now();
  let i = 0;
  while (Date.now() - startTime < dwellMs - 20) {
    const jx = Math.sin(i * 0.5) * 4;
    const jy = Math.cos(i * 0.7) * 3;
    await page.mouse.move(targetX + jx, targetY + jy);
    await page.waitForTimeout(16);
    i++;
  }
  await page.mouse.move(targetX, targetY);
  await page.waitForTimeout(16);

  await page.mouse.up();
  await page.waitForTimeout(350);
}

async function getEmptyCellCenter(page: Page, refWidgetId: string) {
  const grid = page.locator('[data-testid="dashboard-grid"]');
  const gridBox = await grid.boundingBox();
  if (!gridBox) throw new Error("Grid not found");

  const maxColumns = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.maxColumns));
  const gap = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.gap));
  const colWidth = (gridBox.width - gap * (maxColumns - 1)) / maxColumns;

  const refWidget = widgetById(page, refWidgetId);
  const refBox = await refWidget.boundingBox();
  if (!refBox) throw new Error(`Widget "${refWidgetId}" not found`);

  const refCol = Math.round((refBox.x - gridBox.x) / (colWidth + gap));
  const emptyCol = refCol === 0 ? 1 : 0;

  return {
    x: gridBox.x + emptyCol * (colWidth + gap) + colWidth / 2,
    y: refBox.y + refBox.height / 2,
  };
}

async function getWidgetCenter(page: Page, widgetId: string) {
  const widget = widgetById(page, widgetId);
  const box = await widget.boundingBox();
  if (!box) throw new Error(`Widget "${widgetId}" not found`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const GRAB_POSITIONS = [
  ["center", { x: 0.5, y: 0.5 }],
  ["top-left", { x: 0.15, y: 0.15 }],
  ["top-right", { x: 0.85, y: 0.15 }],
  ["bottom-left", { x: 0.15, y: 0.85 }],
  ["bottom-right", { x: 0.85, y: 0.85 }],
] as const;

test.describe("grab position independence", () => {
  test.describe("A B / C C / D x — drag B to empty cell next to D", () => {
    const EXPECTED = [["a", null], ["c", "c"], ["d", "b"]];

    for (const [label, fraction] of GRAB_POSITIONS) {
      test(`grab at ${label}`, async ({ page }) => {
        await setupDashboard(page, ["A B", "C C", "D x"]);
        const target = await getEmptyCellCenter(page, "d");
        await dragWithGrabOffset(page, "b", fraction, target.x, target.y);
        await assertLayout(page, EXPECTED);
      });
    }
  });

  test.describe("A x / C C / D B — drag B to empty cell next to A", () => {
    const EXPECTED = [["a", "b"], ["c", "c"], ["d", null]];

    for (const [label, fraction] of GRAB_POSITIONS) {
      test(`grab at ${label}`, async ({ page }) => {
        await setupDashboard(page, ["A x", "C C", "D B"]);
        const target = await getEmptyCellCenter(page, "a");
        await dragWithGrabOffset(page, "b", fraction, target.x, target.y);
        await assertLayout(page, EXPECTED);
      });
    }
  });

  test.describe("A B — swap should work regardless of grab position", () => {
    const EXPECTED = [["b", "a"]];

    for (const [label, fraction] of GRAB_POSITIONS) {
      test(`grab A at ${label}, drag to B`, async ({ page }) => {
        await setupDashboard(page, ["A B"]);
        const target = await getWidgetCenter(page, "b");
        await dragWithGrabOffset(page, "a", fraction, target.x, target.y);
        await assertLayout(page, EXPECTED);
      });
    }
  });
});
