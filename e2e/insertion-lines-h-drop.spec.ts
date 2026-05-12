import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function dropOnHLine(page: import("@playwright/test").Page, sourceId: string, x: number, y: number) {
  const handle = widgetDragHandleById(page, sourceId);
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.describe("Insertion lines — horizontal drop creates new full-width row", () => {
  test("drop on bottom H-line places source as full-width new last row", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const widgetD = await widgetById(page, "d").boundingBox();
    if (!widgetD) throw new Error("d box");

    await dropOnHLine(page, "a", widgetD.x + widgetD.width / 2, widgetD.y + widgetD.height + 8);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![grid!.length - 1]).toEqual(["a", "a"]);
  });

  test("drop on top H-line places source as full-width new first row", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const widgetA = await widgetById(page, "a").boundingBox();
    if (!widgetA) throw new Error("a box");

    await dropOnHLine(page, "c", widgetA.x + widgetA.width / 2, widgetA.y - 8);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![0]).toEqual(["c", "c"]);
  });

  test("drop on between-row H-line places source between rows full-width", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const widgetB = await widgetById(page, "b").boundingBox();
    const widgetD = await widgetById(page, "d").boundingBox();
    if (!widgetB || !widgetD) throw new Error("box");

    const y = (widgetB.y + widgetB.height + widgetD.y) / 2;
    await dropOnHLine(page, "a", widgetB.x + widgetB.width / 2, y);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid!.find((row) => row[0] === "a" && row[1] === "a")).toBeTruthy();
  });
});
