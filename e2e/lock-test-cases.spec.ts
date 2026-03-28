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

// ── Position lock: widget cannot be dragged ─────────────────────

test.describe("position-locked widget cannot be dragged", () => {
  test("position-locked A cannot be dragged to B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "b");
    await assertLayout(page, [["a", "b"]]);
  });

  test("position-locked A cannot be dragged to C in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "c");
    await assertLayout(page, [["a", "b"], ["c"]]);
  });
});

// ── Position lock: cannot swap onto a position-locked widget ────

test.describe("cannot swap onto a position-locked widget", () => {
  test("B cannot swap onto position-locked A in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "b", "a");
    await assertLayout(page, [["a", "b"]]);
  });

  test("C cannot swap onto position-locked A in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "c", "a");
    await assertLayout(page, [["a", "b"], ["c"]]);
  });

  test("B cannot auto-resize onto position-locked A in A A / B", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "b", "a");
    await assertLayout(page, [["a", "a"], ["b"]]);
  });
});

// ── Position lock: stays in place while others are dragged ──────

test.describe("position-locked widget stays in place during other drags", () => {
  test("lock A, drag B -> C: A stays, B and C swap", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "a");
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c"], ["b"]]);
  });

  test("lock B, drag A -> C: B stays, A and C swap", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await lockPosition(page, "b");
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("lock A in A B C, drag B -> C: A stays", async ({ page }) => {
    await setupDashboard(page, ["A B C"]);
    await lockPosition(page, "a");
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c", "b"]]);
  });
});

// ── Position lock: CAN still be resized ─────────────────────────

test.describe("position-locked widget can still be resized", () => {
  test("position-locked A can be resized in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    await resizeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["a", "a"], ["b"]]);
  });
});

// ── Position lock: CAN still be removed ─────────────────────────

test.describe("position-locked widget can still be removed", () => {
  test("position-locked A can be removed in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    const removeBtn = widgetById(page, "a").getByRole("button", { name: "Remove", exact: true });
    await removeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["b"]]);
  });
});

// ── Unlock position restores normal behavior ────────────────────

test.describe("unlock position restores drag", () => {
  test("lock then unlock position on A, drag A -> B succeeds", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockPosition(page, "a");
    await attemptBlockedDragByIdToId(page, "a", "b");
    await assertLayout(page, [["a", "b"]]);

    await unlockPosition(page, "a");
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });
});

// ── Resize lock: widget cannot be resized ───────────────────────

test.describe("resize-locked widget cannot be resized", () => {
  test("resize-locked A cannot be resized in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockResize(page, "a");
    // Resize buttons should be hidden when resize-locked
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    expect(await resizeBtn.count()).toBe(0);
    await assertLayout(page, [["a", "b"]]);
  });
});

// ── Resize lock: CAN still be dragged ───────────────────────────

test.describe("resize-locked widget can still be dragged", () => {
  test("resize-locked A can be dragged to B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockResize(page, "a");
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });
});

// ── Unlock resize restores resize ───────────────────────────────

test.describe("unlock resize restores resize", () => {
  test("lock then unlock resize on A, resize succeeds", async ({ page }) => {
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

// ── Remove lock: remove button is hidden ────────────────────────

test.describe("remove-locked widget cannot be removed", () => {
  test("remove-locked A: remove button is hidden", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockRemove(page, "a");
    const removeBtn = widgetById(page, "a").getByRole("button", { name: "Remove", exact: true });
    expect(await removeBtn.count()).toBe(0);
    await assertLayout(page, [["a", "b"]]);
  });
});

// ── Remove lock: CAN still be dragged ───────────────────────────

test.describe("remove-locked widget can still be dragged", () => {
  test("remove-locked A can be dragged to B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockRemove(page, "a");
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });
});

// ── Remove lock: CAN still be resized ───────────────────────────

test.describe("remove-locked widget can still be resized", () => {
  test("remove-locked A can be resized in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await lockRemove(page, "a");
    const resizeBtn = widgetResizeButtonById(page, "a", 2);
    await resizeBtn.click();
    await page.waitForTimeout(200);
    await assertLayout(page, [["a", "a"], ["b"]]);
  });
});

// ── Unlock remove restores removal ──────────────────────────────

test.describe("unlock remove restores removal", () => {
  test("lock then unlock remove on A, remove succeeds", async ({ page }) => {
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
