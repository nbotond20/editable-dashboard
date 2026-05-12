import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById } from "./helpers/locators";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — rendering", () => {
  test("no lines visible when idle", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await setDropMode(page, "lines");
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBe(0);
  });

  test("no lines visible in classic mode during drag", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "classic");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.waitForTimeout(100);
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBe(0);
    await page.mouse.up();
  });

  test("lines appear during drag in lines mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
    await page.waitForTimeout(150);
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test("lines disappear after drop", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBe(0);
  });

  test("emits 3 horizontal lines for a single-row layout (above + 1 below + 1 outer-right? no, for 1 row: above + below = 2 H-lines; for 2 rows: above + between + below = 3)", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30);
    await page.waitForTimeout(150);
    const hLines = await page.locator('[data-testid="insertion-line"][data-line-orientation="horizontal"]').count();
    expect(hLines).toBe(3);
    await page.mouse.up();
  });
});
