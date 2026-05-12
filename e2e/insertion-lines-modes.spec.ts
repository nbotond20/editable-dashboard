import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — mode arbitration", () => {
  test("swap on widget center works in classic mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "classic");

    const dBox = await widgetById(page, "d").boundingBox();
    if (!dBox) throw new Error("box");

    const handle = widgetDragHandleById(page, "a");
    const hBox = await handle.boundingBox();
    if (!hBox) throw new Error("handle box");

    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dBox.x + dBox.width / 2, dBox.y + dBox.height / 2);
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).toEqual([["d", "b"], ["c", "a"]]);
  });

  test("swap on widget center works in lines mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const dBox = await widgetById(page, "d").boundingBox();
    if (!dBox) throw new Error("box");

    const handle = widgetDragHandleById(page, "a");
    const hBox = await handle.boundingBox();
    if (!hBox) throw new Error("handle box");

    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dBox.x + dBox.width / 2, dBox.y + dBox.height / 2);
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).toEqual([["d", "b"], ["c", "a"]]);
  });

  test("dead-space drop cancels in lines mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const aBox = await widgetById(page, "a").boundingBox();
    if (!aBox) throw new Error("box");

    const handle = widgetDragHandleById(page, "a");
    const hBox = await handle.boundingBox();
    if (!hBox) throw new Error("handle box");

    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(aBox.x - 200, aBox.y - 200);
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).toEqual([["a", "b"], ["c", "d"]]);
  });
});
