import { test } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout } from "./helpers/layout-utils";
import {
  touchDragByIdToId,
  touchDragByIdToSide,
  touchDragCancelById,
} from "./helpers/drag";

// All tests use 2-col layouts to avoid header overflow on mobile viewport.

// ── Touch: basic swaps ──────────────────────────────────────────

test.describe("Touch: basic swaps", () => {
  test("case 1: A -> B in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await touchDragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"], ["c"]]);
  });

  test("case 16: A -> B in A B", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await touchDragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"]]);
  });

  test("case 5: B -> C in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await touchDragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c"], ["b"]]);
  });
});

// ── Touch: cross-row swaps ──────────────────────────────────────

test.describe("Touch: cross-row swaps", () => {
  test("case 3: A -> C in A B / C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await touchDragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("case 17: A -> C in A B / C D", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await touchDragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a", "d"]]);
  });

  test("case 6: A -> D in A B / C D", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await touchDragByIdToId(page, "a", "d");
    await assertLayout(page, [["d", "b"], ["c", "a"]]);
  });
});

// ── Touch: multi-span swaps ─────────────────────────────────────

test.describe("Touch: multi-span swaps", () => {
  test("case 9: A -> B in A A / B (wide swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await touchDragByIdToId(page, "a", "b");
    await assertLayout(page, [["b"], ["a", "a"]]);
  });

  test("case 25: A -> B in A A / B B (same-span swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"]);
    await touchDragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "b"], ["a", "a"]]);
  });

  test("case 20: A -> B in A A / B C (wide-narrow swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await touchDragByIdToId(page, "a", "b");
    await assertLayout(page, [["b"], ["a", "a"], ["c"]]);
  });
});

// ── Touch: auto-resize ──────────────────────────────────────────

test.describe("Touch: auto-resize", () => {
  test("case 10: B ->| A> in A A / B (resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await touchDragByIdToSide(page, "b", "a", "right");
    await assertLayout(page, [["a", "b"]]);
  });

  test("case 11: B ->| <A in A A / B (resize left)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await touchDragByIdToSide(page, "b", "a", "left");
    await assertLayout(page, [["b", "a"]]);
  });

  test("case 26: B ->| A> in A A / B B (resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"]);
    await touchDragByIdToSide(page, "b", "a", "right");
    await assertLayout(page, [["a", "b"]]);
  });
});

// ── Touch: multi-step ───────────────────────────────────────────

test("Touch multi-step: D -> A then B -> C in A B / C D", async ({ page }) => {
  await setupDashboard(page, ["A B", "C D"]);
  await touchDragByIdToId(page, "d", "a");
  await touchDragByIdToId(page, "b", "c");
  await assertLayout(page, [["d", "c"], ["b", "a"]]);
});

// ── Touch: cancel (scroll intent) ──────────────────────────────

test("Touch cancel: fast move before activation preserves layout", async ({ page }) => {
  await setupDashboard(page, ["A B", "C"]);
  await touchDragCancelById(page, "a", 30);
  await assertLayout(page, [["a", "b"], ["c"]]);
});
