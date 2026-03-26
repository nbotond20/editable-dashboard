import { test, expect } from "./fixtures/dashboard.fixture";
import {
  widgetByLabel,
  widgetLockButton,
  widgetDragHandle,
} from "./helpers/locators";

test.describe("Lock/Unlock Widgets", () => {
  test("each widget has a lock button", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    for (const label of ["Statistics", "Chart", "Notes", "Calendar"]) {
      await expect(widgetLockButton(page, label)).toBeVisible();
    }
  });

  test("clicking lock changes aria-label to Unlock", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const lockBtn = widgetLockButton(page, "Statistics");
    await expect(lockBtn).toHaveAttribute("aria-label", "Lock");

    await lockBtn.click();
    await expect(lockBtn).toHaveAttribute("aria-label", "Unlock");
  });

  test("locked widget gets dash-widget--locked class", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const widget = widgetByLabel(page, "Statistics");
    await expect(widget).not.toHaveClass(/dash-widget--locked/);

    await widgetLockButton(page, "Statistics").click();
    await expect(widget).toHaveClass(/dash-widget--locked/);
  });

  test("locked drag handle gets locked class", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    const handle = widgetDragHandle(page, "Statistics");
    await expect(handle).not.toHaveClass(/dash-widget__drag-handle--locked/);

    await widgetLockButton(page, "Statistics").click();
    await expect(handle).toHaveClass(/dash-widget__drag-handle--locked/);
  });

  test("unlocking removes locked classes", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    // Lock
    await widgetLockButton(page, "Statistics").click();
    await expect(widgetByLabel(page, "Statistics")).toHaveClass(/dash-widget--locked/);

    // Unlock
    await widgetLockButton(page, "Statistics").click();
    await expect(widgetByLabel(page, "Statistics")).not.toHaveClass(/dash-widget--locked/);
    await expect(widgetLockButton(page, "Statistics")).toHaveAttribute("aria-label", "Lock");
  });

  test("locked widget drag handle has cursor default", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const page = dashboardPage.page;

    await widgetLockButton(page, "Statistics").click();

    const cursor = await widgetDragHandle(page, "Statistics").evaluate(
      (el) => (el as HTMLElement).style.cursor
    );
    expect(cursor).toBe("default");
  });
});
