import { test, expect } from "./fixtures/dashboard.fixture";
import {
  widgetByLabel,
  widgetResizeButton,
  columnButton,
  undoButton,
} from "./helpers/locators";

test.describe("Widget Resize", () => {
  test("in 2-column layout, widgets show 2 resize options", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const statsToggles = widgetByLabel(page, "Statistics").locator(".dash-toggle-item");
    await expect(statsToggles).toHaveCount(2);
  });

  test("default Statistics widget has colSpan 1 active", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(widgetResizeButton(page, "Statistics", 1)).toHaveClass(/dash-toggle-item--active/);
    await expect(widgetResizeButton(page, "Statistics", 2)).not.toHaveClass(/dash-toggle-item--active/);
  });

  test("default Chart widget has colSpan 2 active", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(widgetResizeButton(page, "Chart", 2)).toHaveClass(/dash-toggle-item--active/);
    await expect(widgetResizeButton(page, "Chart", 1)).not.toHaveClass(/dash-toggle-item--active/);
  });

  test("clicking 2 columns wide on a 1-col widget makes it full width", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetResizeButton(page, "Statistics", 2).click();

    await expect(widgetResizeButton(page, "Statistics", 2)).toHaveClass(/dash-toggle-item--active/);
    await expect(widgetResizeButton(page, "Statistics", 1)).not.toHaveClass(/dash-toggle-item--active/);
  });

  test("clicking 1 column wide on a 2-col widget makes it half width", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetResizeButton(page, "Chart", 1).click();

    await expect(widgetResizeButton(page, "Chart", 1)).toHaveClass(/dash-toggle-item--active/);
    await expect(widgetResizeButton(page, "Chart", 2)).not.toHaveClass(/dash-toggle-item--active/);
  });

  test("resizing a widget changes its actual width", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // Wait for layout
    await page.waitForTimeout(300);

    const beforeBox = await widgetByLabel(page, "Statistics").boundingBox();
    expect(beforeBox).toBeTruthy();

    await widgetResizeButton(page, "Statistics", 2).click();
    await page.waitForTimeout(500);

    const afterBox = await widgetByLabel(page, "Statistics").boundingBox();
    expect(afterBox).toBeTruthy();

    // Widget should be wider after resizing to 2 cols
    expect(afterBox!.width).toBeGreaterThan(beforeBox!.width * 1.5);
  });

  test("in 3-column layout, 3 toggle buttons appear", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 3).click();

    const statsToggles = widgetByLabel(page, "Statistics").locator(".dash-toggle-item");
    await expect(statsToggles).toHaveCount(3);

    await expect(widgetResizeButton(page, "Statistics", 1)).toBeVisible();
    await expect(widgetResizeButton(page, "Statistics", 2)).toBeVisible();
    await expect(widgetResizeButton(page, "Statistics", 3)).toBeVisible();
  });

  test("resizing a widget enables Undo", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();
    await widgetResizeButton(page, "Statistics", 2).click();
    await expect(undoButton(page)).toBeEnabled();
  });

  test("in 1-column layout, no resize toggles appear", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 1).click();

    const toggleGroups = page.locator(".dash-widget .dash-toggle-group");
    await expect(toggleGroups).toHaveCount(0);
  });
});
