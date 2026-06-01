import { test, expect, type Page } from "@playwright/test";
import { setupDashboardRaw } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function widgetRect(page: Page, id: string) {
  return widgetById(page, id).evaluate((el) => {
    const d = (el as HTMLElement).dataset;
    return { x: Number(d.x), y: Number(d.y), width: Number(d.width), height: Number(d.height) };
  });
}

// A B   (row 0: A col 0, B col 1)
// C x   (row 1: C col 0, free trailing slot at col 1)
//
// Dragging B onto C's trailing slot must place B beside C in row 1 — leaving
// the cell above B (row 0, col 1) empty — instead of compacting B back up
// beside A or scrambling the row order. Regression for a lower-row trailing
// slot resolving to an in-row-insert that greedy-repacked the source into the
// free top band of its column.
test.describe("Lines mode — drop into a lower row's trailing slot", () => {
  test("B -> C's trailing slot places B beside C, keeping the gap above", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "a", type: "calendar", colSpan: 1, order: 0, columnStart: 0 },
        { id: "b", type: "notes", colSpan: 1, order: 1, columnStart: 1 },
        { id: "c", type: "calendar", colSpan: 1, order: 2, columnStart: 0 },
      ],
      2,
    );
    await setDropMode(page, "lines");

    const c = await widgetRect(page, "c");
    const grid = await page.locator('[data-testid="dashboard-grid"]').boundingBox();
    const handle = widgetDragHandleById(page, "b");
    const hb = await handle.boundingBox();
    if (!grid || !hb) throw new Error("boxes");

    // Slot center: trailing free space in C's row (right of C, at C's row).
    const slotCx = grid.x + c.x + c.width + (grid.width - (c.x + c.width)) / 2;
    const slotCy = grid.y + c.y + c.height / 2;

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 40, { steps: 5 });
    await page.mouse.move(slotCx, slotCy, { steps: 12 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(450);

    const af = await widgetRect(page, "a");
    const bf = await widgetRect(page, "b");
    const cf = await widgetRect(page, "c");

    // B sits in C's row (same top), to the right of C.
    expect(Math.abs(bf.y - cf.y)).toBeLessThan(5);
    expect(bf.x).toBeGreaterThan(cf.x + cf.width / 2);
    // C stayed in column 0, below A.
    expect(Math.abs(cf.x - af.x)).toBeLessThan(5);
    expect(cf.y).toBeGreaterThan(af.y + 10);
    // The cell above B (row 0, col 1) is empty — B is not back beside A.
    expect(bf.y).toBeGreaterThan(af.y + 10);
  });
});
