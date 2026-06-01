import { test, expect, type Page } from "@playwright/test";
import { setupDashboardRaw } from "./helpers/setup";
import { widgetDragHandleById } from "./helpers/locators";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function toggleEditing(page: Page) {
  await page.locator('[data-testid="editing-toggle"]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("Lines mode — add slot invalid feedback follows the cursor", () => {
  // banner (min/maxColSpan 2, full-width-only) on row 0; stats on row 1 leaves
  // col 1 free -> one "add a widget" slot on row 1.
  //
  // The user drags the banner by its (left-edge) handle and moves the *cursor*
  // over the slot. The banner is wide, so its footprint centre sits far from the
  // cursor — but the feedback must still follow what the user is pointing at:
  // the slot turns invalid because the full-width banner cannot fit one column.
  test("dragging a full-width banner so the cursor is over the slot marks it invalid", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "banner1", type: "banner", colSpan: 2, order: 0 },
        { id: "stats1", type: "stats", colSpan: 1, order: 1 },
      ],
      2,
    );
    await setDropMode(page, "lines");
    await toggleEditing(page);

    const slot = page.locator('[data-testid="empty-slot"][data-row-index="1"]');
    const slotBox = await slot.boundingBox();
    const handle = widgetDragHandleById(page, "banner1");
    const hb = await handle.boundingBox();
    if (!slotBox || !hb) throw new Error("boxes");

    const grabX = hb.x + hb.width / 2;
    const grabY = hb.y + hb.height / 2;
    // The user gesture: move the cursor onto the slot's centre. The banner is
    // NOT re-centred over the slot the way a footprint-based test would do.
    const targetX = slotBox.x + slotBox.width / 2;
    const targetY = slotBox.y + slotBox.height / 2;

    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX, grabY + 30, { steps: 4 });
    await page.mouse.move(targetX, targetY, { steps: 8 });
    await page.waitForTimeout(150);

    await expect(slot).toHaveAttribute("data-drag-state", "invalid");
    await expect(slot).toHaveAttribute("data-reason", "only-full-width");

    await page.mouse.up();
  });
});
