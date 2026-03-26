import { test, expect } from "./fixtures/dashboard.fixture";
import {
  columnButton,
  widgetByLabel,
  undoButton,
} from "./helpers/locators";

test.describe("Column Layout", () => {
  test("default layout is 2 columns", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(columnButton(page, 2)).toHaveClass(/dash-btn--primary/);
    await expect(columnButton(page, 1)).not.toHaveClass(/dash-btn--primary/);
    await expect(columnButton(page, 3)).not.toHaveClass(/dash-btn--primary/);
  });

  test("clicking 1 col switches to single column layout", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 1).click();

    await expect(columnButton(page, 1)).toHaveClass(/dash-btn--primary/);
    await expect(columnButton(page, 2)).not.toHaveClass(/dash-btn--primary/);
  });

  test("clicking 3 cols switches to 3-column layout", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 3).click();

    await expect(columnButton(page, 3)).toHaveClass(/dash-btn--primary/);
    await expect(columnButton(page, 2)).not.toHaveClass(/dash-btn--primary/);
  });

  test("in 1-column mode, no resize toggles visible", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 1).click();

    // Resize toggle groups should not be visible in 1-col mode
    const toggles = page.locator(".dash-widget .dash-toggle-group");
    await expect(toggles).toHaveCount(0);
  });

  test("in 3-column mode, resize toggles show 3 options", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 3).click();

    // Statistics widget (colSpan 1) should show 3 toggle buttons
    const statsToggles = widgetByLabel(page, "Statistics").locator(".dash-toggle-item");
    await expect(statsToggles).toHaveCount(3);
  });

  test("column change enables Undo", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();
    await columnButton(page, 1).click();
    await expect(undoButton(page)).toBeEnabled();
  });

  test("switching back to 2 cols shows correct active state", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 3).click();
    await expect(columnButton(page, 3)).toHaveClass(/dash-btn--primary/);

    await columnButton(page, 2).click();
    await expect(columnButton(page, 2)).toHaveClass(/dash-btn--primary/);
    await expect(columnButton(page, 3)).not.toHaveClass(/dash-btn--primary/);
  });

  test("in 1-column mode, all widgets span full width", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 1).click();

    // Give layout time to reflow
    await page.waitForTimeout(500);

    const statsBox = await widgetByLabel(page, "Statistics").boundingBox();
    const chartBox = await widgetByLabel(page, "Chart").boundingBox();

    expect(statsBox).toBeTruthy();
    expect(chartBox).toBeTruthy();

    // Both should have similar widths (both spanning full container)
    expect(Math.abs(statsBox!.width - chartBox!.width)).toBeLessThan(5);
  });
});
