import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import {
  getScrollY,
  scrollTo,
  startDragToViewportEdge,
  startDragToViewportCenter,
  waitForScrollDelta,
} from "./helpers/auto-scroll";

// 10-row × 2-col layout — comfortably overflows the 1200 px viewport.
const TALL_LAYOUT = [
  "A B",
  "C D",
  "E F",
  "G H",
  "I J",
  "K L",
  "M N",
  "O P",
  "Q R",
  "S T",
];

test.describe("auto-scroll during drag", () => {
  test("scrolls viewport down when pointer reaches bottom edge", async ({ page }) => {
    await setupDashboard(page, TALL_LAYOUT);

    const { scrollYBeforeDrag } = await startDragToViewportEdge(page, "c", "bottom");
    const scrollYAfter = await waitForScrollDelta(page, scrollYBeforeDrag, 50);

    expect(scrollYAfter).toBeGreaterThan(scrollYBeforeDrag);
    await page.mouse.up();
  });

  test("scrolls viewport up when pointer reaches top edge", async ({ page }) => {
    await setupDashboard(page, TALL_LAYOUT);
    // Scroll down first so there is room to scroll up.
    await scrollTo(page, 300);

    const { scrollYBeforeDrag } = await startDragToViewportEdge(page, "e", "top");
    const scrollYAfter = await waitForScrollDelta(page, scrollYBeforeDrag, 50);

    expect(scrollYAfter).toBeLessThan(scrollYBeforeDrag);
    await page.mouse.up();
  });

  test("does not scroll when pointer stays in safe zone", async ({ page }) => {
    await setupDashboard(page, TALL_LAYOUT);

    const { scrollYBeforeDrag } = await startDragToViewportCenter(page, "c");

    // Hold in the safe zone long enough for auto-scroll to fire if it were active.
    await page.waitForTimeout(500);

    const scrollAfter = await getScrollY(page);
    expect(Math.abs(scrollAfter - scrollYBeforeDrag)).toBeLessThanOrEqual(2);

    await page.mouse.up();
  });

  test("stops scrolling after drop", async ({ page }) => {
    await setupDashboard(page, TALL_LAYOUT);

    const { scrollYBeforeDrag } = await startDragToViewportEdge(page, "c", "bottom");
    await waitForScrollDelta(page, scrollYBeforeDrag, 50);

    // Release the drag — the auto-scroll RAF loop should stop.
    await page.mouse.up();
    await page.waitForTimeout(350); // drop animation

    const scrollAfterDrop = await getScrollY(page);

    // Wait and verify no further scrolling occurs.
    await page.waitForTimeout(500);
    const scrollFinal = await getScrollY(page);

    expect(Math.abs(scrollFinal - scrollAfterDrop)).toBeLessThanOrEqual(2);
  });
});
