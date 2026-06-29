import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation, getWidgetColSpans } from "./helpers/layout-utils";
import { dragByIdToId } from "./helpers/drag";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

const showLinesToggle = (page: Page) => page.locator('[data-testid="show-lines-toggle"]');
const autoResizeToggle = (page: Page) => page.locator('[data-testid="auto-resize-toggle"]');

async function dragHandleOverWidget(page: Page, sourceId: string, targetId: string) {
  const handleBox = await widgetDragHandleById(page, sourceId).boundingBox();
  const targetBox = await widgetById(page, targetId).boundingBox();
  if (!handleBox || !targetBox) throw new Error("box");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
}

async function dragAOverF(page: Page) {
  const box = await widgetDragHandleById(page, "a").boundingBox();
  if (!box) throw new Error("handle box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5);
  const fBox = await widgetById(page, "f").boundingBox();
  if (!fBox) throw new Error("f box");
  await page.mouse.move(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
}

test.describe("Config — showInsertionLines", () => {
  test("toggling lines off hides them", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D E F"]);
    await setDropMode(page, "lines");
    await showLinesToggle(page).click();
    await expect(showLinesToggle(page)).toHaveAttribute("data-active", "false");

    await dragAOverF(page);
    await page.waitForTimeout(200);
    expect(await page.locator('[data-testid="insertion-line-segment"]').count()).toBe(0);
    expect(await page.locator('[data-testid="insertion-line"]').count()).toBe(0);
    await page.mouse.up();
  });

  test("a lines-mode drag still works with lines hidden", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");
    await showLinesToggle(page).click();
    await expect(showLinesToggle(page)).toHaveAttribute("data-active", "false");

    await dragHandleOverWidget(page, "a", "d");
    await page.waitForTimeout(200);
    expect(await page.locator('[data-testid="insertion-line"]').count()).toBe(0);
    await page.mouse.up();
    await page.waitForTimeout(400);

    expect(await getGridRepresentation(page)).toEqual([["d", "b"], ["c", "a"]]);
  });
});

test.describe("Config — autoResize", () => {
  test("classic hover past dwell auto-resizes by default (control)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"], 2);
    await setDropMode(page, "classic");
    await dragByIdToId(page, "b", "a", { dwellMs: 800 });
    await page.waitForTimeout(400);
    expect(await getWidgetColSpans(page)).toEqual({ a: 1, b: 1 });
  });

  test("with auto-resize off, the same hover stays a full-width swap", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"], 2);
    await setDropMode(page, "classic");
    await autoResizeToggle(page).click();
    await expect(autoResizeToggle(page)).toHaveAttribute("data-active", "false");

    await dragByIdToId(page, "b", "a", { dwellMs: 800 });
    await page.waitForTimeout(400);

    expect(await getWidgetColSpans(page)).toEqual({ a: 2, b: 2 });
    expect(await getGridRepresentation(page)).toEqual([["b", "b"], ["a", "a"]]);
  });
});
