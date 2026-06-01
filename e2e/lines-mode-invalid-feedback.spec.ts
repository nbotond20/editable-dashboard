import { test, expect, type Page } from "@playwright/test";
import { setupDashboardRaw } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function toggleEditing(page: Page) {
  await page.locator('[data-testid="editing-toggle"]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  tol = 1,
): boolean {
  return (
    a.x + a.width > b.x + tol &&
    a.x < b.x + b.width - tol &&
    a.y + a.height > b.y + tol &&
    a.y < b.y + b.height - tol
  );
}

test.describe("Lines mode — invalid feedback never overlaps widgets", () => {
  // A B   (row 0)
  // C C   (row 1, C is a fixed full-width banner)
  // Dragging B to the left of C is infeasible (C cannot shrink). The feedback
  // must be a thin red line on C's side — never a box over the first half of C.
  test("dragging B to the left of a fixed full-width C shows a red line, not an overlap", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "a", type: "stats", colSpan: 1, order: 0, columnStart: 0 },
        { id: "b", type: "notes", colSpan: 1, order: 1, columnStart: 1 },
        { id: "c", type: "banner", colSpan: 2, order: 2 },
      ],
      2,
    );
    await setDropMode(page, "lines");

    const c = await widgetById(page, "c").boundingBox();
    const handle = widgetDragHandleById(page, "b");
    const hb = await handle.boundingBox();
    if (!c || !hb) throw new Error("boxes");

    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 4 });

    // Sweep across C's left edge so the pointer crosses the (infeasible) left line.
    const ty = c.y + c.height / 2;
    let sawRedLine = false;
    for (let x = c.x - 8; x <= c.x + c.width * 0.4; x += 10) {
      await page.mouse.move(x, ty, { steps: 2 });
      await page.waitForTimeout(60);
      if ((await page.locator('[data-line-invalid="true"]').count()) > 0) sawRedLine = true;

      // Whatever feedback is showing, no insertion-line element may overlap C.
      const lineRects = await page
        .locator('[data-testid="insertion-line-segment"], [data-testid="insertion-line"]')
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
        );
      const cRect = await widgetById(page, "c").boundingBox();
      for (const lr of lineRects) {
        expect(overlaps(lr, cRect!)).toBe(false);
      }
    }

    expect(sawRedLine).toBe(true);
    // The old overlapping footprint box must be gone entirely.
    await expect(page.locator('[data-testid="invalid-target"]')).toHaveCount(0);

    await page.mouse.up();
  });

  // The empty "add a widget" slot must turn red across its whole area when the
  // dragged widget cannot fit — not only within snap range of its edge line.
  test("add slot turns invalid far from its edge line (whole-area feedback)", async ({ page }) => {
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
    const banner = await widgetById(page, "banner1").boundingBox();
    const handle = widgetDragHandleById(page, "banner1");
    const hb = await handle.boundingBox();
    if (!slotBox || !banner || !hb) throw new Error("boxes");

    const grabX = hb.x + hb.width / 2;
    const grabY = hb.y + hb.height / 2;
    // Cursor position that centers the dragged banner over the slot's centre,
    // which is well beyond snap range of the slot's left-edge line.
    const targetX = slotBox.x + slotBox.width / 2 - banner.width / 2 + (grabX - banner.x);
    const targetY = slotBox.y + slotBox.height / 2;

    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX, grabY + 30, { steps: 4 });
    await page.mouse.move(targetX, targetY, { steps: 6 });
    await page.waitForTimeout(150);

    await expect(slot).toHaveAttribute("data-drag-state", "invalid");
    await expect(slot).toHaveAttribute("data-reason", "only-full-width");

    await page.mouse.up();
  });
});

test.describe("Add a new widget — placement into the clicked slot", () => {
  // chart(2) fills row 0; stats(1) leaves col 1 free on row 1 -> one slot.
  // Clicking that slot then "Add" must place a fitting widget into it.
  test("adds the widget into the clicked slot's free space", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "chart1", type: "chart", colSpan: 2, order: 0 },
        { id: "stats1", type: "stats", colSpan: 1, order: 1 },
      ],
      2,
    );
    await toggleEditing(page);

    await page.locator('[data-testid="empty-slot"][data-row-index="1"]').click();
    await page.locator(".dash-catalog-panel").waitFor();
    // Add a half-width widget (Quick Notes) — fits the single free column.
    await page.locator(".dash-catalog-item").filter({ hasText: "Quick Notes" }).getByRole("button").click();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    // stats1 keeps col 0 of its row; the new widget lands beside it (same row).
    const statsRow = grid!.findIndex((row) => row.includes("stats1"));
    expect(statsRow).toBeGreaterThanOrEqual(0);
    expect(grid![statsRow].filter((c) => c !== "stats1" && c !== null).length).toBe(1);
  });

  // banner (min/maxColSpan 2) cannot fit a single free column -> appends to bottom.
  test("appends to the bottom when the widget's min width exceeds the free space", async ({ page }) => {
    await setupDashboardRaw(
      page,
      [
        { id: "chart1", type: "chart", colSpan: 2, order: 0 },
        { id: "stats1", type: "stats", colSpan: 1, order: 1 },
      ],
      2,
    );
    await toggleEditing(page);

    await page.locator('[data-testid="empty-slot"][data-row-index="1"]').click();
    await page.locator(".dash-catalog-panel").waitFor();
    await page.locator(".dash-catalog-item").filter({ hasText: "Promo Banner" }).getByRole("button").click();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    // The banner is full width on a new last row; stats1's row stays half-empty.
    const lastRow = grid![grid!.length - 1];
    expect(new Set(lastRow).size).toBe(1);
    expect(lastRow[0]).not.toBeNull();
    const statsRow = grid!.findIndex((row) => row.includes("stats1"));
    expect(grid![statsRow]).toContain(null);
  });
});
