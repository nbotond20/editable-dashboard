import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { attemptBlockedDragByIdToId } from "./helpers/drag";
import { getGridRepresentation, getWidgetColSpans } from "./helpers/layout-utils";

async function setDropMode(page: Page, mode: "classic" | "lines") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

const autoResizeToggle = (page: Page) => page.locator('[data-testid="auto-resize-toggle"]');

test.describe("Config — autoResize blocks infeasible swaps", () => {
  test("with auto-resize off, dragging a wide widget onto a narrow slot is blocked", async ({ page }) => {
    await setupDashboard(page, ["A B", "C C"], 2);
    await setDropMode(page, "lines");
    await autoResizeToggle(page).click();
    await expect(autoResizeToggle(page)).toHaveAttribute("data-active", "false");

    await attemptBlockedDragByIdToId(page, "c", "b");

    expect(await getGridRepresentation(page)).toEqual([["a", "b"], ["c", "c"]]);
    expect(await getWidgetColSpans(page)).toEqual({ a: 1, b: 1, c: 2 });
  });

  test("with auto-resize on, the same drag performs the swap (control)", async ({ page }) => {
    await setupDashboard(page, ["A B", "C C"], 2);
    await setDropMode(page, "lines");

    await attemptBlockedDragByIdToId(page, "c", "b");

    expect(await getGridRepresentation(page)).not.toEqual([["a", "b"], ["c", "c"]]);
  });
});
