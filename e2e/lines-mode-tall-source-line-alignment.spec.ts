import { test, expect, type Page } from "@playwright/test";
import { setupDashboardRaw } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

// A B        (row 0; A short, B tall)
// C C        (row 1; full width)
//
// Dragging the taller B onto the H-line above C inserts B as a new full-width
// row. The placement preview removes B from row 0, so A's shorter row collapses
// and C shifts up. The active insertion line and the source ghost used to stay
// pinned to the pre-drag layout, so the line floated in the middle of the
// placement ghost and the source ghost overlapped it. The active line must hug
// the placement ghost's leading edge, and the source ghost must not overlap it.
test.describe("Lines mode — taller source leaving a mixed-height row", () => {
  test("B ->| C-top: active line hugs the place ghost, source ghost does not overlap", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "a", type: "notes", colSpan: 1, order: 0 },
        { id: "b", type: "calendar", colSpan: 1, order: 1 },
        { id: "c", type: "table", colSpan: 2, order: 2 },
      ],
      2,
    );
    await setDropMode(page, "lines");

    const a = await widgetById(page, "a").boundingBox();
    const b = await widgetById(page, "b").boundingBox();
    const c = await widgetById(page, "c").boundingBox();
    const handle = widgetDragHandleById(page, "b");
    const hb = await handle.boundingBox();
    if (!a || !b || !c || !hb) throw new Error("boxes");

    // Precondition: this regression only applies when the source is taller than
    // its row-mate (so removing it collapses the row).
    expect(a.height).toBeLessThan(b.height);

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 5 });

    const placeGhost = page.locator(".dashboard-place-ghost");
    const activeLine = page.locator(
      '[data-testid="insertion-line"][data-line-orientation="horizontal"][data-line-active="true"]',
    );

    // Sweep across C's original top edge until the new-row placement preview shows.
    const tx = c.x + c.width / 2;
    let shown = false;
    for (let dy = 12; dy >= -12 && !shown; dy -= 4) {
      await page.mouse.move(tx, c.y + dy, { steps: 3 });
      await page.waitForTimeout(90);
      shown = (await placeGhost.count()) > 0;
    }

    await expect(placeGhost).toBeVisible();
    await expect(placeGhost).toContainText("Place widget");
    await expect(activeLine).toHaveCount(1);
    await expect(activeLine).toHaveAttribute("data-line-disabled", "false");

    const ghostBox = await placeGhost.boundingBox();
    const lineBox = await activeLine.boundingBox();
    if (!ghostBox || !lineBox) throw new Error("preview boxes");

    const lineCenterY = lineBox.y + lineBox.height / 2;
    // The line hugs the placement ghost's leading (top) edge — it must not float
    // deep inside the ghost as it did before the fix (where it sat ~100px down).
    expect(lineCenterY).toBeLessThanOrEqual(ghostBox.y + 12);
    expect(lineCenterY).toBeGreaterThanOrEqual(ghostBox.y - 40);

    // The source ghost (the dragged widget's origin) must not overlap the
    // placement ghost. While overlapping it is hidden entirely after the fix.
    const sourceGhost = page.locator('[data-testid="source-ghost"]');
    if ((await sourceGhost.count()) > 0) {
      const sg = await sourceGhost.boundingBox();
      if (sg) {
        const overlaps =
          sg.x < ghostBox.x + ghostBox.width &&
          sg.x + sg.width > ghostBox.x &&
          sg.y < ghostBox.y + ghostBox.height &&
          sg.y + sg.height > ghostBox.y;
        expect(overlaps).toBe(false);
      }
    }

    await page.mouse.up();
  });
});
