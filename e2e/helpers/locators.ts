import type { Page, Locator } from "@playwright/test";

export function widgetByLabel(page: Page, label: string): Locator {
  return page
    .locator(".dash-widget")
    .filter({ has: page.locator(".dash-label-emphasis", { hasText: label }) });
}

export function widgetDragHandle(page: Page, label: string): Locator {
  return widgetByLabel(page, label).locator(".dash-widget__drag-handle");
}

export function widgetRemoveButton(page: Page, label: string): Locator {
  return widgetByLabel(page, label).getByRole("button", { name: "Remove" });
}

export function widgetHideButton(page: Page, label: string): Locator {
  return widgetByLabel(page, label).getByRole("button", { name: "Hide" });
}

export function widgetLockButton(page: Page, label: string): Locator {
  return widgetByLabel(page, label).getByRole("button", { name: /^(Lock|Unlock)$/ });
}

export function widgetResizeButton(page: Page, label: string, cols: number): Locator {
  const ariaLabel = cols === 1 ? "1 column wide" : `${cols} columns wide`;
  return widgetByLabel(page, label).getByRole("button", { name: ariaLabel });
}

export function undoButton(page: Page): Locator {
  return page.getByRole("button", { name: "Undo" });
}

export function redoButton(page: Page): Locator {
  return page.getByRole("button", { name: "Redo" });
}

export function columnButton(page: Page, n: number): Locator {
  const text = n === 1 ? "1 col" : `${n} cols`;
  return page.locator(".dash-header").getByRole("button", { name: text, exact: true });
}

export function addWidgetButton(page: Page): Locator {
  return page.getByRole("button", { name: "Add Widget" });
}

export function catalogPanel(page: Page): Locator {
  return page.locator(".dash-catalog-panel");
}

export function catalogOverlay(page: Page): Locator {
  return page.locator(".dash-catalog-overlay");
}

export function catalogCloseButton(page: Page): Locator {
  return catalogPanel(page).getByRole("button", { name: "Close" });
}

export function catalogItem(page: Page, label: string): Locator {
  return catalogPanel(page)
    .locator(".dash-catalog-item")
    .filter({ hasText: label });
}

export function catalogItemAddButton(page: Page, label: string): Locator {
  return catalogItem(page, label).getByRole("button");
}

export function hiddenTag(page: Page, label: string): Locator {
  return page.locator(".dash-tag--clickable").filter({ hasText: label });
}

export function allWidgetLabels(page: Page): Locator {
  return page.locator(".dash-widget .dash-widget__header .dash-label-emphasis");
}

export function dropGhost(page: Page): Locator {
  return page.locator(".dashboard-drop-ghost");
}

export function dashboardGrid(page: Page): Locator {
  return page.locator('[data-testid="dashboard-grid"]');
}

export function dropGhostByTestId(page: Page): Locator {
  return page.locator('[data-testid="drop-ghost"]');
}

export function allWidgetSlots(page: Page): Locator {
  return page.locator("[data-widget-id]");
}

export function widgetById(page: Page, id: string): Locator {
  return page.locator(`[data-widget-id="${id}"]`);
}

export function widgetDragHandleById(page: Page, id: string): Locator {
  return widgetById(page, id).locator(".dash-widget__drag-handle");
}

export function widgetResizeButtonById(page: Page, id: string, cols: number): Locator {
  const ariaLabel = cols === 1 ? "1 column wide" : `${cols} columns wide`;
  return widgetById(page, id).getByRole("button", { name: ariaLabel });
}

export function widgetLockButtonById(page: Page, id: string): Locator {
  return widgetById(page, id).getByRole("button", { name: /^(Lock|Unlock)$/ });
}
