import { test, expect, type Page } from "@playwright/test";
import { setupDashboardRaw } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Lines mode — end-cap stacking", () => {
  // chart(2) on row 0, stats(1) on row 1. Dragging chart into stats' row is a
  // valid in-row insert that shows the place ghost + the circle-plus end cap.
  // The end cap marks the line's far end and can sit over the floating dragged
  // widget — it must never paint on top of it (it's a drop hint, not the thing
  // the user is holding).
  test("the insertion-line end cap renders below the dragged widget", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "chart1", type: "chart", colSpan: 2, order: 0 },
        { id: "stats1", type: "stats", colSpan: 1, order: 1 },
      ],
      2,
    );
    await setDropMode(page, "lines");

    const stats = await widgetById(page, "stats1").boundingBox();
    const grid = await page.locator('[data-testid="dashboard-grid"]').boundingBox();
    const handle = widgetDragHandleById(page, "chart1");
    const hb = await handle.boundingBox();
    if (!stats || !grid || !hb) throw new Error("boxes");

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 4 });

    const ty = stats.y + stats.height / 2;
    const endCap = page.locator('[data-testid="insertion-line-endcap"]');
    let shown = false;
    for (let x = grid.x + 4; x <= grid.x + 360 && !shown; x += 16) {
      await page.mouse.move(x, ty, { steps: 2 });
      await page.waitForTimeout(80);
      shown = (await endCap.count()) > 0;
    }
    expect(shown).toBe(true);

    const capZ = await endCap.evaluate((el) => parseInt(getComputedStyle(el).zIndex || "0", 10));
    const widgetZ = await widgetById(page, "chart1").evaluate((el) => parseInt(getComputedStyle(el).zIndex || "0", 10));

    expect(capZ).toBeLessThan(widgetZ);

    await page.mouse.up();
  });
});
