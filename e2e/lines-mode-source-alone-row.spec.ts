import { test, expect, type Page } from "@playwright/test";
import { setupDashboardRaw } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

// A          (row 0, alone, free column to the right)
// B          (row 1, alone, free column to the right)
// C C        (row 2, full width)
//
// Dragging B onto the H-line directly under A must place B full-width right
// under A — not jump it to the bottom of the list. Regression for the H-line
// above a source's solo row resolving its insertion index to end-of-list
// (the line's afterId is null because the only widget below is the source).
test.describe("Lines mode — H-line above a source that is alone in its row", () => {
  test("B -> H-line under A places B full-width between A and C", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "a", type: "stats", colSpan: 1, order: 0, columnStart: 0 },
        { id: "b", type: "chart", colSpan: 1, order: 1, columnStart: 0 },
        { id: "c", type: "notes", colSpan: 2, order: 2 },
      ],
      2,
    );
    await setDropMode(page, "lines");

    const a = await widgetById(page, "a").boundingBox();
    const b = await widgetById(page, "b").boundingBox();
    const handle = widgetDragHandleById(page, "b");
    const hb = await handle.boundingBox();
    if (!a || !b || !hb) throw new Error("boxes");

    const tx = a.x + a.width / 2;
    const ty = (a.y + a.height + b.y) / 2;

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 6 });
    await page.waitForTimeout(150);

    const placeGhost = page.locator(".dashboard-place-ghost");
    await expect(placeGhost).toBeVisible();
    await expect(placeGhost).toContainText("Place widget");

    await page.mouse.up();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    const bRow = grid!.findIndex((row) => row[0] === "b");
    const cRow = grid!.findIndex((row) => row[0] === "c");
    expect(bRow).toBeGreaterThanOrEqual(0);
    expect(grid![bRow]).toEqual(["b", "b"]);
    expect(bRow).toBeLessThan(cRow);
  });
});
