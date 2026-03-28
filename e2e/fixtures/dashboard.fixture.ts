import { test as base, type Page } from "@playwright/test";

const STORAGE_KEY = "editable-dashboard-state";

export class DashboardPage {
  constructor(public readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
    await this.page.locator(".dash-widget").first().waitFor();
  }

  async getWidgetLabels(): Promise<string[]> {
    return this.page
      .locator(".dash-widget .dash-widget__header .dash-label-emphasis")
      .allTextContents();
  }

  async getWidgetCount(): Promise<number> {
    return this.page.locator(".dash-widget").count();
  }

  async getLocalStorageState() {
    return this.page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
  }
}

export const test = base.extend<{ dashboardPage: DashboardPage }>({
  dashboardPage: async ({ page }, use) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);

    const dp = new DashboardPage(page);
    await use(dp);
  },
});

export { expect } from "@playwright/test";
