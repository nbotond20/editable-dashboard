import { test, expect, type Page } from "@playwright/test";
import { setupDashboardRaw } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function toggleEditing(page: Page) {
  await page.locator('[data-testid="editing-toggle"]').click();
  // The demo header overflows at narrow widths; clicking the far-right toggle
  // scrolls the page horizontally. Reset so coordinate-based drags stay on-screen.
  await page.evaluate(() => window.scrollTo(0, 0));
}

// banner(2) fills row 0; notes(1) leaves one free column on row 1 -> one slot;
// table(2) is full-width on row 2 and is the tall widget being dragged.
//
// Dragging the tall table over row 1's trailing slot makes the slot a valid
// drop target. The "Drop to add here" affordance must grow to the dragged
// widget's height so it previews the footprint the widget will occupy — it
// used to stay pinned to the short row's height.
test.describe("Lines mode — empty slot grows to the dragged widget's height", () => {
  test("trailing slot grows to a taller dragged widget while valid", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "banner1", type: "banner", colSpan: 2, order: 0 },
        { id: "notes1", type: "notes", colSpan: 1, order: 1, columnStart: 0 },
        { id: "table1", type: "table", colSpan: 2, order: 2 },
      ],
      2,
    );
    await setDropMode(page, "lines");
    await toggleEditing(page);

    const slot = page.locator('[data-testid="empty-slot"][data-row-index="1"]');
    await expect(slot).toHaveCount(1);

    const draggedBox = await widgetById(page, "table1").boundingBox();
    const slotBefore = await slot.boundingBox();
    const handle = widgetDragHandleById(page, "table1");
    const hb = await handle.boundingBox();
    if (!draggedBox || !slotBefore || !hb) throw new Error("boxes");

    // Precondition: the slot's row is shorter than the dragged widget.
    expect(slotBefore.height).toBeLessThan(draggedBox.height);

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 20, { steps: 4 });

    // Sweep across the trailing slot until it turns valid.
    const ty = slotBefore.y + slotBefore.height / 2;
    let valid = false;
    for (let x = slotBefore.x - 20; x <= slotBefore.x + slotBefore.width - 10 && !valid; x += 10) {
      await page.mouse.move(x, ty, { steps: 2 });
      await page.waitForTimeout(90);
      valid = (await slot.getAttribute("data-drag-state")) === "valid";
    }

    expect(valid).toBe(true);
    await expect(slot).toContainText("Drop to add here");

    const slotDuring = await slot.boundingBox();
    if (!slotDuring) throw new Error("slot box during drag");
    // The slot grew to the dragged widget's height (within a small tolerance).
    expect(slotDuring.height).toBeGreaterThan(slotBefore.height);
    expect(slotDuring.height).toBeGreaterThanOrEqual(draggedBox.height - 4);

    await page.mouse.up();
  });
});
