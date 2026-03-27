import { test } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout } from "./helpers/layout-utils";
import {
  dragByIdToId,
  dragByIdToSide,
  dragByIdToAdjacentEmpty,
  dragByIdToColumn,
  dragByIdToCoords,
} from "./helpers/drag";
import { widgetById } from "./helpers/locators";

// ── 2-col: A B / C (tests 1–5) ──────────────────────────────────

test.describe("2-col: A B / C", () => {
  test("case 1: A -> B", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a"], ["c"]]);
  });

  test("case 2: B -> A", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await dragByIdToId(page, "b", "a");
    await assertLayout(page, [["b", "a"], ["c"]]);
  });

  test("case 3: A -> C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("case 4: C -> A", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await dragByIdToId(page, "c", "a");
    await assertLayout(page, [["c", "b"], ["a"]]);
  });

  test("case 5: B -> C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C"]);
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c"], ["b"]]);
  });
});

// ── 2-col: A B / C D (tests 6–8) ────────────────────────────────

test.describe("2-col: A B / C D", () => {
  test("case 6: A -> D", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await dragByIdToId(page, "a", "d");
    await assertLayout(page, [["d", "b"], ["c", "a"]]);
  });

  test("case 7: D -> A", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await dragByIdToId(page, "d", "a");
    await assertLayout(page, [["d", "b"], ["c", "a"]]);
  });

  test("case 8: D -> A then B -> C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await dragByIdToId(page, "d", "a");
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["d", "c"], ["b", "a"]]);
  });
});

// ── 2-col: A A / B — swap vs auto-resize (tests 9–11) ───────────

test.describe("2-col: A A / B", () => {
  test("case 9: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b"], ["a", "a"]]);
  });

  test("case 10: B ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await dragByIdToSide(page, "b", "a", "right");
    await assertLayout(page, [["a", "b"]]);
  });

  test("case 11: B ->| <A (auto-resize left)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B"]);
    await dragByIdToSide(page, "b", "a", "left");
    await assertLayout(page, [["b", "a"]]);
  });
});

// ── 3-col: A A A / B B (tests 12a–12b) ──────────────────────────

test.describe("3-col: A A A / B B", () => {
  test("case 12a: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B B"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "b"], ["a", "a", "a"]]);
  });

  test("case 12b: B ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B B"]);
    await dragByIdToSide(page, "b", "a", "right");
    await assertLayout(page, [["a", "b", "b"]]);
  });
});

// ── 3-col: A B C / x D — empty space drags (tests 13–14) ────────

test.describe("3-col: A B C / x D — empty space", () => {
  test("case 13: D -> <D (drag left into empty)", async ({ page }) => {
    await setupDashboard(page, ["A B C", "x D"]);
    await dragByIdToAdjacentEmpty(page, "d", "left");
    await assertLayout(page, [["a", "b", "c"], ["d"]]);
  });

  test("case 14: D -> D> (drag right into empty)", async ({ page }) => {
    await setupDashboard(page, ["A B C", "x D"]);
    await dragByIdToAdjacentEmpty(page, "d", "right");
    await assertLayout(page, [["a", "b", "c"], [null, null, "d"]]);
  });
});

// ── 3-col: A A A / B — auto-resize (test 15) ────────────────────

test("case 15: B ->| <A (auto-resize left)", async ({ page }) => {
  await setupDashboard(page, ["A A A", "B"]);
  await dragByIdToSide(page, "b", "a", "left");
  await assertLayout(page, [["b", "a", "a"]]);
});

// ── 2-col: A B — simple (test 16) ───────────────────────────────

test("case 16: A -> B", async ({ page }) => {
  await setupDashboard(page, ["A B"]);
  await dragByIdToId(page, "a", "b");
  await assertLayout(page, [["b", "a"]]);
});

// ── 2-col: A B / C D — cross-row swaps (tests 17–19) ────────────

test.describe("2-col: A B / C D — cross-row", () => {
  test("case 17: A -> C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a", "d"]]);
  });

  test("case 18: B -> D", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await dragByIdToId(page, "b", "d");
    await assertLayout(page, [["a", "d"], ["c", "b"]]);
  });

  test("case 19: B -> C", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c"], ["b", "d"]]);
  });
});

// ── 2-col: A A / B C (tests 20–24) ──────────────────────────────

test.describe("2-col: A A / B C", () => {
  test("case 20: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b"], ["a", "a"], ["c"]]);
  });

  test("case 21: A -> C (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a", "a"]]);
  });

  test("case 22: B -> C (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "a"], ["c", "b"]]);
  });

  test("case 23: C ->| <A (auto-resize left)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await dragByIdToSide(page, "c", "a", "left");
    await assertLayout(page, [["c", "a"], ["b"]]);
  });

  test("case 24: C ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B C"]);
    await dragByIdToSide(page, "c", "a", "right");
    await assertLayout(page, [["a", "c"], ["b"]]);
  });
});

// ── 2-col: A A / B B (tests 25–27) ──────────────────────────────

test.describe("2-col: A A / B B", () => {
  test("case 25: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "b"], ["a", "a"]]);
  });

  test("case 26: B ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"]);
    await dragByIdToSide(page, "b", "a", "right");
    await assertLayout(page, [["a", "b"]]);
  });

  test("case 27: B ->| <A (auto-resize left)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"]);
    await dragByIdToSide(page, "b", "a", "left");
    await assertLayout(page, [["b", "a"]]);
  });
});

// ── 3-col: A B C (tests 28–30) ──────────────────────────────────

test.describe("3-col: A B C — single row", () => {
  test("case 28: A -> B", async ({ page }) => {
    await setupDashboard(page, ["A B C"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a", "c"]]);
  });

  test("case 29: A -> C", async ({ page }) => {
    await setupDashboard(page, ["A B C"]);
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b", "a"]]);
  });

  test("case 30: B -> C", async ({ page }) => {
    await setupDashboard(page, ["A B C"]);
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "c", "b"]]);
  });
});

// ── 3-col: A B C / D (tests 31–32) ──────────────────────────────

test.describe("3-col: A B C / D", () => {
  test("case 31: A -> D", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D"]);
    await dragByIdToId(page, "a", "d");
    await assertLayout(page, [["d", "b", "c"], ["a"]]);
  });

  test("case 32: C -> D", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D"]);
    await dragByIdToId(page, "c", "d");
    await assertLayout(page, [["a", "b", "d"], ["c"]]);
  });
});

// ── 3-col: A B C / D E (tests 33–34) ────────────────────────────

test.describe("3-col: A B C / D E", () => {
  test("case 33: A -> D", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D E"]);
    await dragByIdToId(page, "a", "d");
    await assertLayout(page, [["d", "b", "c"], ["a", "e"]]);
  });

  test("case 34: E -> B", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D E"]);
    await dragByIdToId(page, "e", "b");
    await assertLayout(page, [["a", "e", "c"], ["d", "b"]]);
  });
});

// ── 3-col: A B C / D E F (tests 35–36) ──────────────────────────

test.describe("3-col: A B C / D E F", () => {
  test("case 35: A -> F", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D E F"]);
    await dragByIdToId(page, "a", "f");
    await assertLayout(page, [["f", "b", "c"], ["d", "e", "a"]]);
  });

  test("case 36: A -> D", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D E F"]);
    await dragByIdToId(page, "a", "d");
    await assertLayout(page, [["d", "b", "c"], ["a", "e", "f"]]);
  });
});

// ── 3-col: A B C / x D — drag to empty (test 37) ────────────────

test("case 37: A -> empty col 0", async ({ page }) => {
  await setupDashboard(page, ["A B C", "x D"]);

  // Compute target: same row as D, but at column 0
  const dWidget = widgetById(page, "d");
  const dBox = await dWidget.boundingBox();
  const grid = page.locator('[data-testid="dashboard-grid"]');
  const gridBox = await grid.boundingBox();
  const maxCols = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.maxColumns));
  const gap = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.gap));
  const colWidth = (gridBox!.width - gap * (maxCols - 1)) / maxCols;

  // Target center of col 0 at D's vertical position
  const targetX = gridBox!.x + colWidth / 2;
  const targetY = dBox!.y + dBox!.height / 2;

  await dragByIdToCoords(page, "a", targetX, targetY);
  await assertLayout(page, [["b", "c"], ["a", "d"]]);
});

// ── 3-col: A A B (tests 38) ─────────────────────────────────────

test("case 38: A A B — A -> B", async ({ page }) => {
  await setupDashboard(page, ["A A B"]);
  await dragByIdToId(page, "a", "b");
  await assertLayout(page, [["b", "a", "a"]]);
});

// ── 3-col: A A B / C (tests 39–40) ──────────────────────────────

test.describe("3-col: A A B / C", () => {
  test("case 39: A -> C", async ({ page }) => {
    await setupDashboard(page, ["A A B", "C"]);
    await dragByIdToId(page, "a", "c");
    await assertLayout(page, [["c", "b"], ["a", "a"]]);
  });

  test("case 40: B -> C", async ({ page }) => {
    await setupDashboard(page, ["A A B", "C"]);
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "a", "c"], ["b"]]);
  });
});

// ── 3-col: A B B (test 41) ──────────────────────────────────────

test("case 41: A B B — A -> B", async ({ page }) => {
  await setupDashboard(page, ["A B B"]);
  await dragByIdToId(page, "a", "b");
  await assertLayout(page, [["b", "b", "a"]]);
});

// ── 3-col: A A A / B (tests 42–43) ──────────────────────────────

test.describe("3-col: A A A / B", () => {
  test("case 42: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b"], ["a", "a", "a"]]);
  });

  test("case 43: B ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B"]);
    await dragByIdToSide(page, "b", "a", "right");
    await assertLayout(page, [["a", "a", "b"]]);
  });
});

// ── 3-col: A A A / B C (tests 44–47) ────────────────────────────

test.describe("3-col: A A A / B C", () => {
  test("case 44: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B C"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b"], ["a", "a", "a"], ["c"]]);
  });

  test("case 45: B -> C (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B C"]);
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "a", "a"], ["c", "b"]]);
  });

  test("case 46: B ->| <A (auto-resize left)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B C"]);
    await dragByIdToSide(page, "b", "a", "left");
    await assertLayout(page, [["b", "a", "a"], ["c"]]);
  });

  test("case 47: C ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B C"]);
    await dragByIdToSide(page, "c", "a", "right");
    await assertLayout(page, [["a", "a", "c"], ["b"]]);
  });
});

// ── 3-col: A A / B B (tests 48–49) — 3-col context ──────────────

test.describe("3-col: A A / B B", () => {
  test("case 48: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"], 3);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "b"], ["a", "a"]]);
  });

  test("case 49: B ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A", "B B"], 3);
    await dragByIdToSide(page, "b", "a", "right");
    await assertLayout(page, [["a", "b", "b"]]);
  });
});

// ── 3-col: A A B / C C (tests 50–51) ────────────────────────────

test.describe("3-col: A A B / C C", () => {
  test("case 50: A -> B", async ({ page }) => {
    await setupDashboard(page, ["A A B", "C C"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a", "a"], ["c", "c"]]);
  });

  test("case 51: C -> A", async ({ page }) => {
    await setupDashboard(page, ["A A B", "C C"]);
    await dragByIdToId(page, "c", "a");
    await assertLayout(page, [["c", "c", "b"], ["a", "a"]]);
  });
});

// ── 3-col: A A A / B B C (tests 52–54) ──────────────────────────

test.describe("3-col: A A A / B B C", () => {
  test("case 52: A -> B (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B B C"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "b"], ["a", "a", "a"], ["c"]]);
  });

  test("case 53: B -> C (swap)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B B C"]);
    await dragByIdToId(page, "b", "c");
    await assertLayout(page, [["a", "a", "a"], ["c", "b", "b"]]);
  });

  test("case 54: C ->| A> (auto-resize right)", async ({ page }) => {
    await setupDashboard(page, ["A A A", "B B C"]);
    await dragByIdToSide(page, "c", "a", "right");
    await assertLayout(page, [["a", "a", "c"], ["b", "b"]]);
  });
});

// ── 3-col: A A A / B B — auto-resize (test 55) ──────────────────

test("case 55: B ->| <A (auto-resize left)", async ({ page }) => {
  await setupDashboard(page, ["A A A", "B B"]);
  await dragByIdToSide(page, "b", "a", "left");
  await assertLayout(page, [["b", "b", "a"]]);
});

// ── Multi-step: 3-col A B C / D E F (test 56) ───────────────────

test("case 56: A -> F then B -> E", async ({ page }) => {
  await setupDashboard(page, ["A B C", "D E F"]);
  await dragByIdToId(page, "a", "f");
  await dragByIdToId(page, "b", "e");
  await assertLayout(page, [["f", "e", "c"], ["d", "b", "a"]]);
});

// ── Multi-step: 2-col A B / C D (test 57) ───────────────────────

test("case 57: A -> D then C -> B", async ({ page }) => {
  await setupDashboard(page, ["A B", "C D"]);
  await dragByIdToId(page, "a", "d");
  await dragByIdToId(page, "c", "b");
  await assertLayout(page, [["d", "c"], ["b", "a"]]);
});

// ── 3-col: A B C / D x x — empty space drags (tests 58–60) ──────

test.describe("3-col: A B C / D x x — empty space", () => {
  test("case 58: D -> x1 (drag right into adjacent empty)", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D x x"]);
    await dragByIdToAdjacentEmpty(page, "d", "right");
    await assertLayout(page, [["a", "b", "c"], [null, "d"]]);
  });

  test("case 59: D -> x2 (drag right into far empty)", async ({ page }) => {
    await setupDashboard(page, ["A B C", "D x x"]);
    await dragByIdToColumn(page, "d", 2);
    await assertLayout(page, [["a", "b", "c"], [null, null, "d"]]);
  });
});

// ── 3-col: A A B / C D — auto-resize (test 60) ──────────────────

test("case 60: D ->| <A (auto-resize left)", async ({ page }) => {
  await setupDashboard(page, ["A A B", "C D"]);
  await dragByIdToSide(page, "d", "a", "left");
  await assertLayout(page, [["d", "a", "b"], ["c"]]);
});

// ── 3-col: A A B / C D x — drag to empty (test 61) ──────────────

test("case 61: D -> x (drag right into empty)", async ({ page }) => {
  await setupDashboard(page, ["A A B", "C D x"]);
  await dragByIdToAdjacentEmpty(page, "d", "right");
  await assertLayout(page, [["a", "a", "b"], ["c", null, "d"]]);
});

// ── 3-col: A B C / x x D — swap (test 62) ───────────────────────

test("case 62: D -> B (swap with pinned widget)", async ({ page }) => {
  await setupDashboard(page, ["A B C", "x x D"]);
  await dragByIdToId(page, "d", "b");
  await assertLayout(page, [["a", "d", "c"], [null, null, "b"]]);
});

// ── 3-col: A B C / x x D — auto-resize (test 63) ────────────────

test("case 63: D ->| B (auto-resize with pinned widget)", async ({ page }) => {
  await setupDashboard(page, ["A B C", "x x D"]);
  await dragByIdToSide(page, "d", "b", "left");
  await assertLayout(page, [["a", "d", "c"], [null, null, "b"]]); 
});

// ── 3-col: A B C / x x D — same-row swaps (tests 64–65) ─────────

test.describe("3-col: A B C / x x D — same-row swaps", () => {
  test("case 64: C -> B", async ({ page }) => {
    await setupDashboard(page, ["A B C", "x x D"]);
    await dragByIdToId(page, "c", "b");
    await assertLayout(page, [["a", "c", "b"], [null, null, "d"]]);
  });

  test("case 65: A -> B", async ({ page }) => {
    await setupDashboard(page, ["A B C", "x x D"]);
    await dragByIdToId(page, "a", "b");
    await assertLayout(page, [["b", "a", "c"], [null, null, "d"]]);
  });
});
