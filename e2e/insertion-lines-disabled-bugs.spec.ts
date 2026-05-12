import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — regression: lines previously flagged disabled-by-order", () => {
  test("H-line above next row is enabled when dragging a widget out of a mixed row", async ({ page }) => {
    await setupDashboard(page, ["A B", "C C", "D"], 2);
    await setDropMode(page, "lines");

    const handle = widgetDragHandleById(page, "b");
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("handle box");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2 + 20);
    await page.waitForTimeout(150);

    const line = page.locator('[data-testid="insertion-line"][data-line-orientation="horizontal"]').nth(1);
    await expect(line).toHaveAttribute("data-line-disabled", "false");

    await page.mouse.up();
  });

  test("V-line at right of A is enabled when dragging full-width B from below (A X / B B → drop B right of A resizes B)", async ({ page }) => {
    await setupDashboard(page, ["A X", "B B"], 2);
    await setDropMode(page, "lines");

    const handle = widgetDragHandleById(page, "b");
    const handleBox = await handle.boundingBox();
    const aBox = await widgetById(page, "a").boundingBox();
    if (!handleBox || !aBox) throw new Error("box");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();

    const targetX = aBox.x + aBox.width + 4;
    const targetY = aBox.y + aBox.height / 2;
    await page.mouse.move(targetX, targetY);
    await page.waitForTimeout(150);

    const activeLine = page.locator('[data-testid="insertion-line"][data-line-orientation="vertical"][data-line-active="true"]');
    await expect(activeLine).toHaveCount(1);
    await expect(activeLine).toHaveAttribute("data-line-disabled", "false");

    await page.mouse.up();
    await page.waitForTimeout(400);

    const aBox2 = await widgetById(page, "a").boundingBox();
    const bBox2 = await widgetById(page, "b").boundingBox();
    if (!aBox2 || !bBox2) throw new Error("post-drop boxes");
    expect(Math.abs(bBox2.y - aBox2.y)).toBeLessThan(4);
    expect(bBox2.x).toBeGreaterThan(aBox2.x);
    expect(bBox2.width).toBeLessThan(aBox2.width + aBox2.x);
  });

  test("V-line at right of single-widget row is enabled and inserts into that row", async ({ page }) => {
    await setupDashboard(page, ["A", "B B", "C D"], 2);
    await setDropMode(page, "lines");

    const handle = widgetDragHandleById(page, "d");
    const handleBox = await handle.boundingBox();
    const a = await widgetById(page, "a").boundingBox();
    if (!handleBox || !a) throw new Error("box");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();

    const targetX = a.x + a.width + 4;
    const targetY = a.y + a.height / 2;
    await page.mouse.move(targetX, targetY);
    await page.waitForTimeout(150);

    const activeLine = page.locator('[data-testid="insertion-line"][data-line-orientation="vertical"][data-line-active="true"]');
    await expect(activeLine).toHaveCount(1);
    await expect(activeLine).toHaveAttribute("data-line-disabled", "false");

    await page.mouse.up();
    await page.waitForTimeout(400);

    const aBox = await widgetById(page, "a").boundingBox();
    const dBox = await widgetById(page, "d").boundingBox();
    if (!aBox || !dBox) throw new Error("post-drop boxes");
    expect(Math.abs(dBox.y - aBox.y)).toBeLessThan(4);
    expect(dBox.x).toBeGreaterThan(aBox.x);
  });
});
