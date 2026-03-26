import { test, expect } from "./fixtures/dashboard.fixture";
import {
  widgetByLabel,
  widgetRemoveButton,
  undoButton,
  addWidgetButton,
  catalogItemAddButton,
  catalogCloseButton,
} from "./helpers/locators";

test.describe("Remove Widget", () => {
  test("each widget has a remove button", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    for (const label of ["Statistics", "Chart", "Notes", "Calendar"]) {
      await expect(widgetRemoveButton(page, label)).toBeVisible();
    }
  });

  test("clicking remove button removes the widget from the grid", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    expect(await dashboardPage.getWidgetCount()).toBe(4);

    await widgetRemoveButton(page, "Statistics").click();

    await expect(page.locator(".dash-widget")).toHaveCount(3);
    await expect(widgetByLabel(page, "Statistics")).not.toBeVisible();
  });

  test("removing last of a type shows Add in catalog", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetRemoveButton(page, "Statistics").click();

    await addWidgetButton(page).click();
    const statsBtn = catalogItemAddButton(page, "Statistics");
    await expect(statsBtn).not.toHaveText(/Another/);
  });

  test("removing a widget enables the Undo button", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();
    await widgetRemoveButton(page, "Statistics").click();
    await expect(undoButton(page)).toBeEnabled();
  });

  test("removing all widgets results in an empty grid", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    for (const label of ["Statistics", "Chart", "Notes", "Calendar"]) {
      await widgetRemoveButton(page, label).click();
    }

    await expect(page.locator(".dash-widget")).toHaveCount(0);
  });
});
