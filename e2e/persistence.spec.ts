import { test as base, expect } from "@playwright/test";
import {
  widgetByLabel,
  widgetRemoveButton,
  widgetHideButton,
  widgetResizeButton,
  columnButton,
  hiddenTag,
} from "./helpers/locators";

const STORAGE_KEY = "editable-dashboard-state";

// Use raw page (no addInitScript) so reloads preserve localStorage
const test = base;

async function gotoClean(page: base.Page) {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await page.locator(".dash-widget").first().waitFor();
}

test.describe("localStorage Persistence", () => {
  test("initial load with empty localStorage uses default 4 widgets", async ({ page }) => {
    await gotoClean(page);

    const labels = await page
      .locator(".dash-widget .dash-widget__header .dash-label-emphasis")
      .allTextContents();
    expect(labels).toEqual(["Statistics", "Chart", "Notes", "Calendar"]);
  });

  test("localStorage key is editable-dashboard-state", async ({ page }) => {
    await gotoClean(page);

    const state = await page.evaluate(() =>
      localStorage.getItem("editable-dashboard-state")
    );
    expect(state).toBeTruthy();
  });

  test("localStorage value has correct schema", async ({ page }) => {
    await gotoClean(page);

    const state = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
    expect(state).toBeTruthy();
    expect(state).toHaveProperty("version");
    expect(state).toHaveProperty("widgets");
    expect(state).toHaveProperty("maxColumns");
    expect(state).toHaveProperty("gap");
    expect(Array.isArray(state.widgets)).toBe(true);
  });

  test("after removing a widget and reloading, widget stays removed", async ({ page }) => {
    await gotoClean(page);

    await widgetRemoveButton(page, "Statistics").click();
    await expect(page.locator(".dash-widget")).toHaveCount(3);

    // Reload without clearing localStorage
    await page.goto("/");
    await page.locator(".dash-widget").first().waitFor();

    await expect(page.locator(".dash-widget")).toHaveCount(3);
    await expect(widgetByLabel(page, "Statistics")).not.toBeVisible();
  });

  test("column layout resets to default 2 cols on reload (not persisted)", async ({ page }) => {
    await gotoClean(page);

    await columnButton(page, 3).click();
    await expect(columnButton(page, 3)).toHaveClass(/dash-btn--primary/);

    await page.goto("/");
    await page.locator(".dash-widget").first().waitFor();

    // App.tsx hardcodes maxColumns={2} — only widgets are persisted
    await expect(columnButton(page, 2)).toHaveClass(/dash-btn--primary/);
  });

  test("after hiding a widget and reloading, widget stays hidden", async ({ page }) => {
    await gotoClean(page);

    await widgetHideButton(page, "Statistics").click();
    await expect(hiddenTag(page, "Statistics")).toBeVisible();

    await page.goto("/");
    await page.locator(".dash-widget").first().waitFor();

    await expect(widgetByLabel(page, "Statistics")).not.toBeVisible();
    await expect(hiddenTag(page, "Statistics")).toBeVisible();
  });

  test("after resizing a widget and reloading, new size persists", async ({ page }) => {
    await gotoClean(page);

    await widgetResizeButton(page, "Statistics", 2).click();
    await expect(widgetResizeButton(page, "Statistics", 2)).toHaveClass(/dash-toggle-item--active/);

    await page.goto("/");
    await page.locator(".dash-widget").first().waitFor();

    await expect(widgetResizeButton(page, "Statistics", 2)).toHaveClass(/dash-toggle-item--active/);
  });

  test("corrupted localStorage is handled gracefully", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("editable-dashboard-state", "{invalid json");
    });

    await page.goto("/");
    await page.locator(".dash-widget").first().waitFor();

    await expect(page.locator(".dash-widget")).toHaveCount(4);
  });

  test("empty string in localStorage is handled gracefully", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("editable-dashboard-state", "");
    });

    await page.goto("/");
    await page.locator(".dash-widget").first().waitFor();

    await expect(page.locator(".dash-widget")).toHaveCount(4);
  });
});
