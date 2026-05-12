import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function dropOnVLine(page: import("@playwright/test").Page, sourceId: string, x: number, y: number) {
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

test.describe("Insertion lines — vertical drop in-row insertion", () => {
  test("V-line drop without resize when row has space", async ({ page }) => {
    await setupDashboard(page, ["A", "B"], 3);
    await setDropMode(page, "lines");

    const widgetA = await widgetById(page, "a").boundingBox();
    if (!widgetA) throw new Error("a");
    const x = widgetA.x + widgetA.width;
    const y = widgetA.y + widgetA.height / 2;

    await dropOnVLine(page, "b", x, y);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![0][0]).toBe("a");
    expect(grid![0][1]).toBe("b");
  });

  test("V-line drop with equal-distribute resize when row overflows", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"], 3);
    await setDropMode(page, "lines");

    const widgetA = await widgetById(page, "a").boundingBox();
    if (!widgetA) throw new Error("a");
    const x = widgetA.x + widgetA.width;
    const y = widgetA.y + widgetA.height / 2;

    await dropOnVLine(page, "b", x, y);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![0]).toEqual(["a", "a", "b"]);
  });
});
