import { test, expect } from "./fixtures/dashboard.fixture";
import {
  undoButton,
  redoButton,
  widgetByLabel,
  widgetRemoveButton,
  widgetHideButton,
  widgetResizeButton,
  widgetLockButton,
  columnButton,
  addWidgetButton,
  catalogItemAddButton,
  catalogCloseButton,
  hiddenTag,
} from "./helpers/locators";

test.describe("Undo/Redo", () => {
  test("both buttons disabled on fresh load", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();
    await expect(redoButton(page)).toBeDisabled();
  });

  test("after add widget: Undo enabled, Redo disabled", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await catalogItemAddButton(page, "Team Members").click();
    await catalogCloseButton(page).click();

    await expect(undoButton(page)).toBeEnabled();
    await expect(redoButton(page)).toBeDisabled();
  });

  test("undo after add removes the widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await catalogItemAddButton(page, "Team Members").click();
    await catalogCloseButton(page).click();
    await expect(page.locator(".dash-widget")).toHaveCount(5);

    await undoButton(page).click();
    await expect(page.locator(".dash-widget")).toHaveCount(4);
    await expect(widgetByLabel(page, "Team")).not.toBeVisible();
  });

  test("redo after undo re-adds the widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await addWidgetButton(page).click();
    await catalogItemAddButton(page, "Team Members").click();
    await catalogCloseButton(page).click();

    await undoButton(page).click();
    await expect(page.locator(".dash-widget")).toHaveCount(4);

    await redoButton(page).click();
    await expect(page.locator(".dash-widget")).toHaveCount(5);
    await expect(widgetByLabel(page, "Team")).toBeVisible();
  });

  test("undo works for remove widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetRemoveButton(page, "Statistics").click();
    await expect(widgetByLabel(page, "Statistics")).not.toBeVisible();

    await undoButton(page).click();
    await expect(widgetByLabel(page, "Statistics")).toBeVisible();
    await expect(page.locator(".dash-widget")).toHaveCount(4);
  });

  test("undo works for hide widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetHideButton(page, "Statistics").click();
    await expect(widgetByLabel(page, "Statistics")).not.toBeVisible();
    await expect(hiddenTag(page, "Statistics")).toBeVisible();

    await undoButton(page).click();
    await expect(widgetByLabel(page, "Statistics")).toBeVisible();
    await expect(hiddenTag(page, "Statistics")).not.toBeVisible();
  });

  test("undo works for resize widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(widgetResizeButton(page, "Statistics", 1)).toHaveClass(/dash-toggle-item--active/);

    await widgetResizeButton(page, "Statistics", 2).click();
    await expect(widgetResizeButton(page, "Statistics", 2)).toHaveClass(/dash-toggle-item--active/);

    await undoButton(page).click();
    await expect(widgetResizeButton(page, "Statistics", 1)).toHaveClass(/dash-toggle-item--active/);
  });

  test("undo works for column change", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await columnButton(page, 3).click();
    await expect(columnButton(page, 3)).toHaveClass(/dash-btn--primary/);

    await undoButton(page).click();
    await expect(columnButton(page, 2)).toHaveClass(/dash-btn--primary/);
  });

  test("performing a new action after undo clears redo stack", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // Action 1
    await widgetRemoveButton(page, "Statistics").click();
    // Undo
    await undoButton(page).click();
    await expect(redoButton(page)).toBeEnabled();

    // New action clears redo stack
    await widgetRemoveButton(page, "Chart").click();
    await expect(redoButton(page)).toBeDisabled();
  });

  test("multiple sequential undos walk back through history", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // Action 1: remove Statistics
    await widgetRemoveButton(page, "Statistics").click();
    await expect(page.locator(".dash-widget")).toHaveCount(3);

    // Action 2: remove Chart
    await widgetRemoveButton(page, "Chart").click();
    await expect(page.locator(".dash-widget")).toHaveCount(2);

    // Undo action 2
    await undoButton(page).click();
    await expect(page.locator(".dash-widget")).toHaveCount(3);
    await expect(widgetByLabel(page, "Chart")).toBeVisible();

    // Undo action 1
    await undoButton(page).click();
    await expect(page.locator(".dash-widget")).toHaveCount(4);
    await expect(widgetByLabel(page, "Statistics")).toBeVisible();
  });

  test("lock/unlock does NOT enable Undo", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();
    await widgetLockButton(page, "Statistics").click();
    await expect(undoButton(page)).toBeDisabled();
  });
});
