import { test, expect, type Page } from "@playwright/test";
import { setupDashboard, setupDashboardRaw } from "./helpers/setup";
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

test.describe("Lines mode — placement affordances", () => {
  test("empty slots appear only while editing", async ({ page }) => {
    await setupDashboard(page, ["A"], 2); // one 1-col widget -> one free column
    await expect(page.locator('[data-testid="empty-slot"]')).toHaveCount(0);

    await toggleEditing(page);
    await expect(page.locator('[data-testid="empty-slot"]')).toHaveCount(1);

    await toggleEditing(page);
    await expect(page.locator('[data-testid="empty-slot"]')).toHaveCount(0);
  });

  test("place-widget ghost + end-cap show on a valid lines drop", async ({ page }) => {
    // chart(2) on row 0, stats(1) on row 1 — dragging chart into stats' row is a
    // valid in-row insert that shrinks chart and shows a placement preview.
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
    const placeGhost = page.locator(".dashboard-place-ghost");
    let shown = false;
    for (let x = grid.x + 4; x <= grid.x + 360 && !shown; x += 16) {
      await page.mouse.move(x, ty, { steps: 2 });
      await page.waitForTimeout(80);
      shown = (await placeGhost.count()) > 0;
    }

    await expect(placeGhost).toBeVisible();
    await expect(placeGhost).toContainText("Place widget");
    await expect(page.locator('[data-testid="insertion-line-endcap"]')).toHaveCount(1);

    await page.mouse.up();
  });

  test("red invalid line shows on the side for a full-width-only widget", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "banner1", type: "banner", colSpan: 2, order: 0 },
        { id: "stats1", type: "stats", colSpan: 1, order: 1 },
      ],
      2,
    );
    await setDropMode(page, "lines");

    const stats = await widgetById(page, "stats1").boundingBox();
    const grid = await page.locator('[data-testid="dashboard-grid"]').boundingBox();
    const handle = widgetDragHandleById(page, "banner1");
    const hb = await handle.boundingBox();
    if (!stats || !grid || !hb) throw new Error("boxes");

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 4 });

    const ty = stats.y + stats.height / 2;
    // The infeasible drop is marked with a red insertion line (never an
    // overlapping footprint box), so the old invalid-target box must be gone.
    const invalidLine = page.locator('[data-line-invalid="true"]');
    let shown = false;
    for (let x = grid.x + 4; x <= grid.x + 360 && !shown; x += 16) {
      await page.mouse.move(x, ty, { steps: 2 });
      await page.waitForTimeout(70);
      shown = (await invalidLine.count()) > 0;
    }

    expect(shown).toBe(true);
    await expect(page.locator('[data-testid="invalid-target"]')).toHaveCount(0);

    await page.mouse.up();
  });

  test("add-widget slot stays visible through a lines-mode drag", async ({ page }) => {
    // chart(2) fills row 0; stats(1) leaves one free column on row 1 -> one slot.
    await setupDashboardRaw(
      page,
      [
        { id: "chart1", type: "chart", colSpan: 2, order: 0 },
        { id: "stats1", type: "stats", colSpan: 1, order: 1 },
      ],
      2,
    );
    await setDropMode(page, "lines");
    await toggleEditing(page);

    const slot = page.locator('[data-testid="empty-slot"]');
    await expect(slot).toHaveCount(1);

    const handle = widgetDragHandleById(page, "chart1");
    const hb = await handle.boundingBox();
    if (!hb) throw new Error("box");
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 40, { steps: 5 });

    await expect(page.locator('[data-testid="dashboard-grid"]')).toHaveAttribute("data-phase", "dragging");
    await expect(slot).toHaveCount(1);

    await page.mouse.up();
  });

  test("slot turns valid (no duplicate ghost) when a fitting widget is over it", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "chart1", type: "chart", colSpan: 2, order: 0 },
        { id: "stats1", type: "stats", colSpan: 1, order: 1 },
      ],
      2,
    );
    await setDropMode(page, "lines");
    await toggleEditing(page);

    const slot = page.locator('[data-testid="empty-slot"][data-row-index="1"]');
    const slotBox = await slot.boundingBox();
    const handle = widgetDragHandleById(page, "chart1");
    const hb = await handle.boundingBox();
    if (!slotBox || !hb) throw new Error("boxes");

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 4 });

    // The trailing-insert snap line sits at the slot's left edge — sweep across it.
    const ty = slotBox.y + slotBox.height / 2;
    let valid = false;
    for (let x = slotBox.x - 30; x <= slotBox.x + 60 && !valid; x += 8) {
      await page.mouse.move(x, ty, { steps: 3 });
      await page.waitForTimeout(90);
      valid = (await slot.getAttribute("data-drag-state")) === "valid";
    }

    expect(valid).toBe(true);
    await expect(slot).toContainText("Drop to add here");
    await expect(page.locator('[data-testid="drop-ghost"]')).toHaveCount(0);

    await page.mouse.up();
  });

  test("slot turns invalid (no duplicate box) for a full-width-only widget over it", async ({ page }) => {
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

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 4 });

    const ty = slotBox.y + slotBox.height / 2;
    let invalid = false;
    for (let x = slotBox.x - 30; x <= slotBox.x + 60 && !invalid; x += 8) {
      await page.mouse.move(x, ty, { steps: 3 });
      await page.waitForTimeout(90);
      invalid = (await slot.getAttribute("data-drag-state")) === "invalid";
    }

    expect(invalid).toBe(true);
    await expect(slot).toHaveAttribute("data-reason", "only-full-width");
    await expect(slot).toContainText("only comes in full width");
    await expect(page.locator('[data-testid="invalid-target"]')).toHaveCount(0);

    await page.mouse.up();
  });
});
