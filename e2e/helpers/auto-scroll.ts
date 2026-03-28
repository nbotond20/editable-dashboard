import type { Page } from "@playwright/test";
import { widgetDragHandleById } from "./locators";
import { humanizePath } from "./humanize-path";

/** Read the current vertical scroll offset. */
export async function getScrollY(page: Page): Promise<number> {
  return page.evaluate(() => window.scrollY);
}

/** Set the window scroll position and wait for it to settle. */
export async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(100);
}

/**
 * Wait until `window.scrollY` has changed by at least `minDelta` pixels
 * from `initialScrollY`.  Uses in-browser RAF-based polling for efficiency.
 *
 * Returns the final `scrollY` value.
 * Throws (Playwright timeout) if the condition is not met in time.
 */
export async function waitForScrollDelta(
  page: Page,
  initialScrollY: number,
  minDelta: number,
  timeoutMs = 3000,
): Promise<number> {
  await page.waitForFunction(
    ({ initial, delta }) => Math.abs(window.scrollY - initial) >= delta,
    { initial: initialScrollY, delta: minDelta },
    { timeout: timeoutMs },
  );
  return page.evaluate(() => window.scrollY);
}

/**
 * Begin dragging a widget and move the pointer to the specified viewport edge.
 * The mouse button stays pressed — the caller must release with `page.mouse.up()`.
 *
 * @param edge        Which viewport edge to approach (`"top"` or `"bottom"`).
 * @param edgeOffset  Distance in px from the edge (default 30, inside the 60 px
 *                    auto-scroll zone).
 * @returns The scroll position captured just before the drag movement starts,
 *          so callers can measure the auto-scroll delta accurately.
 */
export async function startDragToViewportEdge(
  page: Page,
  sourceId: string,
  edge: "top" | "bottom",
  options?: { edgeOffset?: number },
): Promise<{ scrollYBeforeDrag: number }> {
  const edgeOffset = options?.edgeOffset ?? 30;

  const handle = widgetDragHandleById(page, sourceId);
  await handle.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not get bounding box");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport not available");

  const targetY =
    edge === "bottom" ? viewport.height - edgeOffset : edgeOffset;

  const scrollYBeforeDrag = await page.evaluate(() => window.scrollY);

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const points = humanizePath(startX, startY, startX, targetY);
  for (const pt of points) {
    await page.mouse.move(pt.x, pt.y);
    if (pt.pauseMs) await page.waitForTimeout(pt.pauseMs);
  }

  return { scrollYBeforeDrag };
}

/**
 * Begin dragging a widget and move the pointer to the viewport center (safe zone).
 * Useful for verifying that auto-scroll does **not** fire.
 * The mouse button stays pressed — the caller must release with `page.mouse.up()`.
 */
export async function startDragToViewportCenter(
  page: Page,
  sourceId: string,
): Promise<{ scrollYBeforeDrag: number }> {
  const handle = widgetDragHandleById(page, sourceId);
  await handle.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not get bounding box");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport not available");

  const scrollYBeforeDrag = await page.evaluate(() => window.scrollY);

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  // Move to viewport center with a small X offset to ensure the 5 px
  // activation threshold is exceeded.
  const points = humanizePath(
    startX,
    startY,
    startX + 50,
    viewport.height / 2,
  );
  for (const pt of points) {
    await page.mouse.move(pt.x, pt.y);
    if (pt.pauseMs) await page.waitForTimeout(pt.pauseMs);
  }

  return { scrollYBeforeDrag };
}
