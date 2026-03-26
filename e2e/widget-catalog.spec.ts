import { test, expect } from "./fixtures/dashboard.fixture";
import {
  addWidgetButton,
  catalogPanel,
  catalogOverlay,
  catalogCloseButton,
  catalogItemAddButton,
} from "./helpers/locators";

test.describe("Widget Catalog", () => {
  test("clicking Add Widget opens the catalog panel", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(catalogPanel(page)).not.toBeVisible();
    await addWidgetButton(page).click();
    await expect(catalogPanel(page)).toBeVisible();
  });

  test("catalog overlay is visible when open", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await expect(catalogOverlay(page)).toBeVisible();
  });

  test("catalog shows all 5 widget types", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();

    const items = catalogPanel(page).locator(".dash-catalog-item");
    await expect(items).toHaveCount(5);

    const labels = await catalogPanel(page).locator(".dash-catalog-item .dash-label-emphasis").allTextContents();
    expect(labels).toEqual(["Statistics", "Chart", "Team Members", "Quick Notes", "Calendar"]);
  });

  test("existing widget types show Add Another, missing show Add", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();

    // Statistics, Chart, Notes, Calendar are active — should show "Add Another"
    await expect(catalogItemAddButton(page, "Statistics")).toHaveText(/Add Another/);
    await expect(catalogItemAddButton(page, "Chart")).toHaveText(/Add Another/);
    await expect(catalogItemAddButton(page, "Quick Notes")).toHaveText(/Add Another/);
    await expect(catalogItemAddButton(page, "Calendar")).toHaveText(/Add Another/);

    // Team Members not present — should show "Add"
    const teamBtn = catalogItemAddButton(page, "Team Members");
    await expect(teamBtn).toHaveText(/^.*Add$/);
    await expect(teamBtn).not.toHaveText(/Another/);
  });

  test("clicking Add adds a new widget to the grid", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    expect(await dashboardPage.getWidgetCount()).toBe(4);

    await addWidgetButton(page).click();
    await catalogItemAddButton(page, "Team Members").click();

    // Close catalog and verify
    await catalogCloseButton(page).click();
    await expect(page.locator(".dash-widget")).toHaveCount(5);

    const labels = await dashboardPage.getWidgetLabels();
    expect(labels).toContain("Team");
  });

  test("clicking Add Another adds a duplicate widget type", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await catalogItemAddButton(page, "Statistics").click();
    await catalogCloseButton(page).click();

    const labels = await dashboardPage.getWidgetLabels();
    const statsCount = labels.filter((l) => l === "Statistics").length;
    expect(statsCount).toBe(2);
  });

  test("after adding a missing type, button text changes to Add Another", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();

    const teamBtn = catalogItemAddButton(page, "Team Members");
    await expect(teamBtn).not.toHaveText(/Another/);

    await teamBtn.click();
    await expect(teamBtn).toHaveText(/Add Another/);
  });

  test("clicking overlay closes the catalog", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await expect(catalogPanel(page)).toBeVisible();

    await catalogOverlay(page).click({ force: true });
    await expect(catalogPanel(page)).not.toBeVisible();
  });

  test("pressing Escape closes the catalog", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await expect(catalogPanel(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(catalogPanel(page)).not.toBeVisible();
  });

  test("clicking Close button closes the catalog", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await expect(catalogPanel(page)).toBeVisible();

    await catalogCloseButton(page).click();
    await expect(catalogPanel(page)).not.toBeVisible();
  });
});
