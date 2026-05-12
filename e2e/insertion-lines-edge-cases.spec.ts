import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById } from "./helpers/locators";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — edge cases", () => {
  test("1-column mode emits only horizontal lines", async ({ page }) => {
    await setupDashboard(page, ["A", "B", "C"], 1);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 50);
    await page.waitForTimeout(150);
    const vLines = await page.locator('[data-testid="insertion-line"][data-line-orientation="vertical"]').count();
    expect(vLines).toBe(0);
    const hLines = await page.locator('[data-testid="insertion-line"][data-line-orientation="horizontal"]').count();
    expect(hLines).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test("self-adjacent line is rendered as disabled", async ({ page }) => {
    await setupDashboard(page, ["A B"], 2);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5);
    await page.waitForTimeout(150);
    const disabledLines = await page.locator('[data-testid="insertion-line"][data-line-disabled="true"]').count();
    expect(disabledLines).toBeGreaterThan(0);
    await page.mouse.up();
  });
});
