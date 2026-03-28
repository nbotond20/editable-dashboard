import { test } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout } from "./helpers/layout-utils";
import {
  dragByIdToId,
  dragByIdToSide,
  attemptBlockedDragByIdToId,
} from "./helpers/drag";
import {
  widgetLockButtonById,
  widgetResizeButtonById,
} from "./helpers/locators";

async function lockWidget(page: import("@playwright/test").Page, id: string) {
  await widgetLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

async function unlockWidget(page: import("@playwright/test").Page, id: string) {
  await widgetLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

// ── Locked widget cannot be dragged ──────────────────────────────

test.describe("locked widget cannot be dragged", () => {
  test("locked A cannot be dragged to B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockWidget(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "b");
    await assertLayout(page, [["a", "b"]]);
  });

  test("locked A cannot be dragged to C in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockWidget(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "c");
    await assertLayout(page, [["a", "b"], ["c"]]);
  });
});

// ── Cannot swap onto a locked widget ─────────────────────────────

test.describe("cannot swap onto a locked widget", () => {
  test("B cannot swap onto locked A in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockWidget(page, "a");
    await attemptBlockedDragByIdToId(page, "b", "a");
    await assertLayout(page, [["a", "b"]]);
  });

  test("C cannot swap onto locked A in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockWidget(page, "a");
    await attemptBlockedDragByIdToId(page, "c", "a");
    await assertLayout(page, [["a", "b"], ["c"]]);
  });

  test("B cannot auto-resize onto locked A in A A / B", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await lockWidget(page, "a");
    await attemptBlockedDragByIdToId(page, "b", "a");
    await assertLayout(page, [["a", "a"], ["b"]]);
  });
});

// ── Locked widget stays in place while others are dragged ────────

test.describe("locked widget stays in place during other drags", () => {
  test("lock A, drag B -> C: A stays, B and C swap", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockWidget(page, "a");
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c"], ["b"]]);
  });

  test("lock B, drag A -> C: B stays, A and C swap", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockWidget(page, "b");
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("lock A in A B C, drag B -> C: A stays", async ({ page }) => {
    await setupDashboard(page, ["A B C"]);
    await lockWidget(page, "a");
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c", "b"]]);
  });
});

// ── Locked widget cannot be resized ──────────────────────────────

test.describe("locked widget cannot be resized", () => {
  test("locked A cannot be resized in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockWidget(page, "a");
    // Resize button should be hidden or disabled; click should have no effect
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    if ((await resizeBtn.count()) > 0) {
      await resizeBtn.click();
      await page.waitForTimeout(200);
    }
    await assertLayout(page, [["a", "b"]]);
  });
});

// ── Unlock restores normal behavior ──────────────────────────────

test.describe("unlock restores drag", () => {
  test("lock then unlock A, drag A -> B succeeds", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockWidget(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "b");
    await assertLayout(page, [["a", "b"]]);

    await unlockWidget(page, "a");
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });
});
