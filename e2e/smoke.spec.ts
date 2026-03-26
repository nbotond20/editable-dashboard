import { test, expect } from "./fixtures/dashboard.fixture";
import {
  allWidgetLabels,
  undoButton,
  redoButton,
  columnButton,
  addWidgetButton,
} from "./helpers/locators";

test.describe("Dashboard smoke test", () => {
  test("loads with 4 default widgets", async ({ dashboardPage }) => {
    await dashboardPage.goto();

    const labels = await dashboardPage.getWidgetLabels();
    expect(labels).toEqual(["Statistics", "Chart", "Notes", "Calendar"]);
  });

  test("displays the header with Dashboard title", async ({ dashboardPage }) => {
    await dashboardPage.goto();

    await expect(dashboardPage.page.locator("h1")).toHaveText("Dashboard");
  });

  test("shows Undo and Redo buttons disabled initially", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeDisabled();
  });

  test("shows 2 cols as active column layout", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(columnButton(page, 2)).toHaveClass(/dash-btn--primary/);
    await expect(columnButton(page, 1)).not.toHaveClass(/dash-btn--primary/);
    await expect(columnButton(page, 3)).not.toHaveClass(/dash-btn--primary/);
  });

  test("shows Add Widget button", async ({ dashboardPage }) => {
    await dashboardPage.goto();

    await expect(addWidgetButton(dashboardPage.page)).toBeVisible();
  });
});
