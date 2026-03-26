import { test, expect } from "./fixtures/dashboard.fixture";
import {
  widgetDragHandle,
  widgetByLabel,
  widgetLockButton,
  widgetResizeButton,
  undoButton,
} from "./helpers/locators";

test.describe("Keyboard Drag and Drop", () => {
  test("Space on focused drag handle picks up widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const handle = widgetDragHandle(page, "Statistics");
    await handle.focus();
    await page.keyboard.press("Space");

    // The drag handle should be pressed (keyboard-dragging state)
    await expect(handle).toHaveAttribute("aria-pressed", "true");
  });

  test("ArrowDown moves widget position down", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const handle = widgetDragHandle(page, "Statistics");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");

    await page.waitForTimeout(350);

    const labels = await dashboardPage.getWidgetLabels();
    // Statistics should have moved down from position 0
    expect(labels[0]).not.toBe("Statistics");
  });

  test("ArrowUp moves widget position up", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // Move Notes (3rd widget) up
    const handle = widgetDragHandle(page, "Notes");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Space");

    await page.waitForTimeout(350);

    const labels = await dashboardPage.getWidgetLabels();
    // Notes should have moved up from its original position
    const notesIndex = labels.indexOf("Notes");
    expect(notesIndex).toBeLessThan(2); // Originally index 2
  });

  test("Escape cancels keyboard drag and restores position", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const labelsBefore = await dashboardPage.getWidgetLabels();

    const handle = widgetDragHandle(page, "Statistics");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");

    await page.waitForTimeout(350);

    const labelsAfter = await dashboardPage.getWidgetLabels();
    expect(labelsAfter).toEqual(labelsBefore);
  });

  test("Enter also drops the widget", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const handle = widgetDragHandle(page, "Statistics");
    await handle.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await page.waitForTimeout(350);

    const labels = await dashboardPage.getWidgetLabels();
    expect(labels[0]).not.toBe("Statistics");
  });

  test("ArrowRight grows widget colSpan during keyboard drag", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // Statistics starts at colSpan 1
    await expect(widgetResizeButton(page, "Statistics", 1)).toHaveClass(/dash-toggle-item--active/);

    const handle = widgetDragHandle(page, "Statistics");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");

    await page.waitForTimeout(350);

    // Should now be colSpan 2
    await expect(widgetResizeButton(page, "Statistics", 2)).toHaveClass(/dash-toggle-item--active/);
  });

  test("ArrowLeft shrinks widget colSpan during keyboard drag", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // Chart starts at colSpan 2
    await expect(widgetResizeButton(page, "Chart", 2)).toHaveClass(/dash-toggle-item--active/);

    const handle = widgetDragHandle(page, "Chart");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");

    await page.waitForTimeout(350);

    // Should now be colSpan 1
    await expect(widgetResizeButton(page, "Chart", 1)).toHaveClass(/dash-toggle-item--active/);
  });

  test("keyboard drag on locked widget does nothing", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetLockButton(page, "Statistics").click();

    const labelsBefore = await dashboardPage.getWidgetLabels();

    const handle = widgetDragHandle(page, "Statistics");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");

    await page.waitForTimeout(350);

    const labelsAfter = await dashboardPage.getWidgetLabels();
    expect(labelsAfter).toEqual(labelsBefore);

    // aria-pressed should remain false (drag never activated)
    await expect(handle).not.toHaveAttribute("aria-pressed", "true");
  });

  test("keyboard drag enables Undo", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await expect(undoButton(page)).toBeDisabled();

    const handle = widgetDragHandle(page, "Statistics");
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");

    await page.waitForTimeout(350);

    await expect(undoButton(page)).toBeEnabled();
  });
});
