import { test, expect } from "./fixtures/dashboard.fixture";
import {
  widgetByLabel,
  widgetHideButton,
  hiddenTag,
  undoButton,
} from "./helpers/locators";

test.describe("Hide/Show Widgets", () => {
  test("each widget has a hide button", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    for (const label of ["Statistics", "Chart", "Notes", "Calendar"]) {
      await expect(widgetHideButton(page, label)).toBeVisible();
    }
  });

  test("clicking hide removes widget from the visible grid", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    expect(await dashboardPage.getWidgetCount()).toBe(4);

    await widgetHideButton(page, "Statistics").click();

    await expect(page.locator(".dash-widget")).toHaveCount(3);
    await expect(widgetByLabel(page, "Statistics")).not.toBeVisible();
  });

  test("Hidden section appears with clickable tag", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // No hidden section initially
    await expect(page.locator(".dash-label-sm", { hasText: "Hidden:" })).not.toBeVisible();

    await widgetHideButton(page, "Statistics").click();

    await expect(page.locator(".dash-label-sm", { hasText: "Hidden:" })).toBeVisible();
    await expect(hiddenTag(page, "Statistics")).toBeVisible();
  });

  test("clicking hidden tag restores the widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetHideButton(page, "Statistics").click();
    await expect(page.locator(".dash-widget")).toHaveCount(3);

    await hiddenTag(page, "Statistics").click();

    await expect(page.locator(".dash-widget")).toHaveCount(4);
    await expect(widgetByLabel(page, "Statistics")).toBeVisible();
  });

  test("restoring a widget removes its tag", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetHideButton(page, "Statistics").click();
    await expect(hiddenTag(page, "Statistics")).toBeVisible();

    await hiddenTag(page, "Statistics").click();
    await expect(hiddenTag(page, "Statistics")).not.toBeVisible();
  });

  test("when all hidden widgets restored, Hidden section disappears", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetHideButton(page, "Statistics").click();
    await expect(page.locator(".dash-label-sm", { hasText: "Hidden:" })).toBeVisible();

    await hiddenTag(page, "Statistics").click();
    await expect(page.locator(".dash-label-sm", { hasText: "Hidden:" })).not.toBeVisible();
  });

  test("hiding a widget enables Undo", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();
    await widgetHideButton(page, "Statistics").click();
    await expect(undoButton(page)).toBeEnabled();
  });

  test("multiple widgets can be hidden simultaneously", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetHideButton(page, "Statistics").click();
    await widgetHideButton(page, "Chart").click();

    await expect(page.locator(".dash-widget")).toHaveCount(2);
    await expect(hiddenTag(page, "Statistics")).toBeVisible();
    await expect(hiddenTag(page, "Chart")).toBeVisible();
  });
});
