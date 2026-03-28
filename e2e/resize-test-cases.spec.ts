import { test } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout } from "./helpers/layout-utils";
import { widgetResizeButtonById } from "./helpers/locators";

// ── 3-col: A A B / x C D — resize (test 1) ──────────────────────

test("case 1: C resize to 2 columns", async ({ page }) => {
  await setupDashboard(page, ["A A B", "x C D"]);
  await widgetResizeButtonById(page, "c", 2).click();
  await assertLayout(page, [["a", "a", "b"], ["c", "c", "d"]]);
});

// ── 3-col: A B B / C x D — resize (test 2) ──────────────────────

test("case 2: D resize to 2 columns", async ({ page }) => {
  await setupDashboard(page, ["A B B", "C x D"]);
  await widgetResizeButtonById(page, "d", 2).click();
  await assertLayout(page, [["a", "b", "b"], ["c", "d", "d"]]);
});

// ── 3-col: A B B / C D x — resize (test 3) ──────────────────────

test("case 3: C resize to 2 columns", async ({ page }) => {
  await setupDashboard(page, ["A B B", "C D x"]);
  await widgetResizeButtonById(page, "c", 2).click();
  await assertLayout(page, [["a", "b", "b"], ["c", "c", "d"]]);
});
