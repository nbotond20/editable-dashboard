import type { Page } from "@playwright/test";
import { widgetDragHandleById } from "./locators";

/** Focus the drag handle for a widget by ID. */
export async function focusDragHandle(page: Page, widgetId: string) {
  const handle = widgetDragHandleById(page, widgetId);
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
}

/** Pick up a widget via keyboard (Space on its drag handle). */
export async function keyboardPickup(page: Page, widgetId: string) {
  await focusDragHandle(page, widgetId);
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
}

/** Move a picked-up widget up or down by pressing ArrowUp/ArrowDown. */
export async function keyboardMove(
  page: Page,
  direction: "up" | "down",
  count = 1,
) {
  const key = direction === "up" ? "ArrowUp" : "ArrowDown";
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(50);
  }
}

/** Resize a picked-up widget by pressing ArrowLeft (shrink) / ArrowRight (grow). */
export async function keyboardResize(
  page: Page,
  direction: "shrink" | "grow",
  count = 1,
) {
  const key = direction === "shrink" ? "ArrowLeft" : "ArrowRight";
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(50);
  }
}

/** Drop the currently picked-up widget (Space). */
export async function keyboardDrop(page: Page) {
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
}

/** Cancel the current keyboard drag (Escape). */
export async function keyboardCancel(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}
