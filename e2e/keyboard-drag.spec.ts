import { test } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout } from "./helpers/layout-utils";
import {
  keyboardPickup,
  keyboardMove,
  keyboardResize,
  keyboardDrop,
  keyboardCancel,
} from "./helpers/keyboard";

// ── Pickup & cancel ─────────────────────────────────────────────

test("kb: pickup and cancel returns to original layout", async ({ page }) => {
  await setupDashboard(page, ["A B", "C"]);
  await keyboardPickup(page, "a");
  await keyboardCancel(page);
  await assertLayout(page, [["a", "b"], ["c"]]);
});

// ── Move down ───────────────────────────────────────────────────

test.describe("kb: move down", () => {
  test("A down 2 in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "a");
    await keyboardMove(page, "down", 2);
    await keyboardDrop(page);
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("D up 1 in A B C / D", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D"]);
    await keyboardPickup(page, "d");
    await keyboardMove(page, "up", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "b", "d"], [null, null, "c"]]);
  });
});

// ── Move up ─────────────────────────────────────────────────────

test.describe("kb: move up", () => {
  test("C up 1 in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "c");
    await keyboardMove(page, "up", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "c"], [null, "b"]]);
  });

  test("C up 2 in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "c");
    await keyboardMove(page, "up", 2);
    await keyboardDrop(page);
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("B up 1 in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "b");
    await keyboardMove(page, "up", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["b"], ["a"], ["c"]]);
  });

  test("D up 3 in A B C / D", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D"]);
    await keyboardPickup(page, "d");
    await keyboardMove(page, "up", 3);
    await keyboardDrop(page);
    await assertLayout(page, [["d", "b", "c"], ["a"]]);
  });
});

// ── Resize ──────────────────────────────────────────────────────

test.describe("kb: resize", () => {
  test("grow A from 1 to 2 in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "a");
    await keyboardResize(page, "grow", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "a"], ["c", "b"]]);
  });

  test("shrink A from 2 to 1 in A A / B", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await keyboardPickup(page, "a");
    await keyboardResize(page, "shrink", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a"], ["b"]]);
  });

  test("shrink A from 3 to 2 in A A A / B", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B"]);
    await keyboardPickup(page, "a");
    await keyboardResize(page, "shrink", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "a"], ["b"]]);
  });

  test("grow B in A B C (3-col)", async ({ page }) => {
    await setupDashboard(page, ["A B C"]);
    await keyboardPickup(page, "b");
    await keyboardResize(page, "grow", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "b", "b"], [null, null, "c"]]);
  });
});

// ── Move + resize combined ──────────────────────────────────────

test.describe("kb: move + resize", () => {
  test("A down 2 and grow in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "a");
    await keyboardMove(page, "down", 2);
    await keyboardResize(page, "grow", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["c", "b"], ["a", "a"]]);
  });

  test("B up 1 and grow in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "b");
    await keyboardMove(page, "up", 1);
    await keyboardResize(page, "grow", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["b", "b"], ["a"], ["c"]]);
  });

  test("A shrink + down in A A / B C", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await keyboardPickup(page, "a");
    await keyboardResize(page, "shrink", 1);
    await keyboardMove(page, "down", 2);
    await keyboardDrop(page);
    await assertLayout(page, [["b", "c"], [null, "a"]]);
  });
});

// ── Boundary conditions ─────────────────────────────────────────

test.describe("kb: boundary conditions", () => {
  test("move up at top is no-op", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "a");
    await keyboardMove(page, "up", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "b"], ["c"]]);
  });

  test("move down at bottom is no-op", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await keyboardPickup(page, "c");
    await keyboardMove(page, "down", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "b"], ["c"]]);
  });

  test("shrink at colSpan 1 is no-op", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await keyboardPickup(page, "a");
    await keyboardResize(page, "shrink", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "b"]]);
  });

  test("grow caps at maxColumns", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await keyboardPickup(page, "a");
    await keyboardResize(page, "grow", 5);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "a"], [null, "b"]]);
  });
});

// ── 3-col layouts ───────────────────────────────────────────────

test.describe("kb: 3-col layouts", () => {
  test("D up 3 in A B C / D", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D"]);
    await keyboardPickup(page, "d");
    await keyboardMove(page, "up", 3);
    await keyboardDrop(page);
    await assertLayout(page, [["d", "b", "c"], ["a"]]);
  });

  test("A down 3 in A B C / D E F", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D E F"]);
    await keyboardPickup(page, "a");
    await keyboardMove(page, "down", 3);
    await keyboardDrop(page);
    await assertLayout(page, [["a", "b", "c"], ["e", "f", "d"]]);
  });
});

// ── Wide widget reorder ─────────────────────────────────────────

test.describe("kb: wide widget reorder", () => {
  test("A(span=2) down 1 in A A / B C", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await keyboardPickup(page, "a");
    await keyboardMove(page, "down", 1);
    await keyboardDrop(page);
    await assertLayout(page, [["b"], ["a", "a"], [null, "c"]]);
  });

  test("A(span=2) down 2 in A A / B C", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await keyboardPickup(page, "a");
    await keyboardMove(page, "down", 2);
    await keyboardDrop(page);
    await assertLayout(page, [["b", "c"], ["a", "a"]]);
  });
});
