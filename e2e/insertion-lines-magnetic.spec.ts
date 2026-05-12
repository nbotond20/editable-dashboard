import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — magnetic snap", () => {
  test("active flag flips on when pointer enters snap radius", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await setDropMode(page, "lines");

    const handle = widgetDragHandleById(page, "a");
    const handleBox = await handle.boundingBox();
    const widgetB = await widgetById(page, "b").boundingBox();
    if (!handleBox || !widgetB) throw new Error("box");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    const targetX = widgetB.x + widgetB.width;
    const targetY = widgetB.y + widgetB.height / 2;
    await page.mouse.move(targetX + 30, targetY);
    await page.waitForTimeout(150);

    let activeCount = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(activeCount).toBe(0);

    await page.mouse.move(targetX + 4, targetY);
    await page.waitForTimeout(150);

    activeCount = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(activeCount).toBe(1);

    await page.mouse.up();
  });

  test("hysteresis keeps line active when pointer moves slightly past snap radius", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await setDropMode(page, "lines");

    const handle = widgetDragHandleById(page, "a");
    const handleBox = await handle.boundingBox();
    const widgetB = await widgetById(page, "b").boundingBox();
    if (!handleBox || !widgetB) throw new Error("box");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    const targetX = widgetB.x + widgetB.width;
    const targetY = widgetB.y + widgetB.height / 2;

    await page.mouse.move(targetX + 4, targetY);
    await page.waitForTimeout(150);

    await page.mouse.move(targetX + 20, targetY);
    await page.waitForTimeout(150);
    const activeCount = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(activeCount).toBe(1);

    await page.mouse.move(targetX + 30, targetY);
    await page.waitForTimeout(150);
    const noneActive = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(noneActive).toBe(0);

    await page.mouse.up();
  });
});
