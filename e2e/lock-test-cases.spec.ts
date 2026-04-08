import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout } from "./helpers/layout-utils";
import {
  dragByIdToId,
  attemptBlockedDragByIdToId,
} from "./helpers/drag";
import {
  widgetPositionLockButtonById,
  widgetResizeLockButtonById,
  widgetRemoveLockButtonById,
  widgetResizeButtonById,
  widgetById,
} from "./helpers/locators";

async function lockPosition(page: import("@playwright/test").Page, id: string) {
  await widgetPositionLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

async function unlockPosition(page: import("@playwright/test").Page, id: string) {
  await widgetPositionLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

async function lockResize(page: import("@playwright/test").Page, id: string) {
  await widgetResizeLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

async function unlockResize(page: import("@playwright/test").Page, id: string) {
  await widgetResizeLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

async function lockRemove(page: import("@playwright/test").Page, id: string) {
  await widgetRemoveLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

async function unlockRemove(page: import("@playwright/test").Page, id: string) {
  await widgetRemoveLockButtonById(page, id).click();
  await page.waitForTimeout(100);
}

// ═══════════════════════════════════════════════════════════════════
//  Position lock
// ═══════════════════════════════════════════════════════════════════

test.describe("position lock", () => {
  test("locked widget cannot be dragged (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "b");
    await assertLayout(page, [["a", "b"]]);
  });

  test("locked widget cannot be dragged cross-row (A B / C)", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "c");
    await assertLayout(page, [["a", "b"], ["c"]]);
  });

  test("cannot swap onto locked widget (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "b", "a");
    await assertLayout(page, [["a", "b"]]);
  });

  test("cannot swap onto locked widget cross-row (A B / C)", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "c", "a");
    await assertLayout(page, [["a", "b"], ["c"]]);
  });

  test("cannot auto-resize onto locked widget (A A / B)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "b", "a");
    await assertLayout(page, [["a", "a"], ["b"]]);
  });

  test("stays in place: lock A, drag B -> C (A B / C)", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "a");
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c"], ["b"]]);
  });

  test("stays in place: lock B, drag A -> C (A B / C)", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "b");
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("stays in place: lock A, drag B -> C (A B C)", async ({ page }) => {
    await setupDashboard(page, ["A B C"]);
    await lockPosition(page, "a");
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c", "b"]]);
  });

  test("locked widget can still be resized (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    await resizeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["a", "a"], ["b"]]);
  });

  test("locked widget can still be removed (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    const removeBtn = widgetById(page, "a").getByRole("button", { name: "Remove", exact: true });
    await removeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["b"]]);
  });

  test("unlock restores drag (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "b");
    await assertLayout(page, [["a", "b"]]);

    await unlockPosition(page, "a");
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Resize lock
// ═══════════════════════════════════════════════════════════════════

test.describe("resize lock", () => {
  test("locked widget cannot be resized (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockResize(page, "a");
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    expect(await resizeBtn.count()).toBe(0);
    await assertLayout(page, [["a", "b"]]);
  });

  test("locked widget can still be dragged (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockResize(page, "a");
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });

  test("unlock restores resize (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockResize(page, "a");
    expect(await widgetResizeButtonById(page, "a", 2).count()).toBe(0);

    await unlockResize(page, "a");
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    await resizeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["a", "a"], ["b"]]);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Remove lock
// ═══════════════════════════════════════════════════════════════════

test.describe("remove lock", () => {
  test("locked widget: remove button is hidden (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockRemove(page, "a");
    const removeBtn = widgetById(page, "a").getByRole("button", { name: "Remove", exact: true });
    expect(await removeBtn.count()).toBe(0);
    await assertLayout(page, [["a", "b"]]);
  });

  test("locked widget can still be dragged (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockRemove(page, "a");
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });

  test("locked widget can still be resized (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockRemove(page, "a");
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    await resizeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["a", "a"], ["b"]]);
  });

  test("unlock restores removal (A B)", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockRemove(page, "a");
    let removeBtn = widgetById(page, "a").getByRole("button", { name: "Remove", exact: true });
    expect(await removeBtn.count()).toBe(0);

    await unlockRemove(page, "a");
    removeBtn = widgetById(page, "a").getByRole("button", { name: "Remove", exact: true });
    await removeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["b"]]);
  });
});
