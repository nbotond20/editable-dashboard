import { describe, it, expect } from "vitest";
import { computeLayout } from "../../layout/compute-layout.ts";
import {
  solveBaseLayout,
  solveDragLayout,
  solvePreviewLayout,
  type LayoutSolverConfig,
} from "../layout-solver.ts";
import type { WidgetState } from "../../types.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../../constants.ts";

// ─── Helpers ──────────────────────────────────────────────────

function makeWidget(
  id: string,
  order: number,
  colSpan = 1,
  visible = true
): WidgetState {
  return { id, type: "test", colSpan, visible, order };
}

function makeHeights(
  entries: Array<[string, number]>
): Map<string, number> {
  return new Map(entries);
}

const CONTAINER_WIDTH = 400;
const MAX_COLUMNS = 2;
const GAP = 16;
// colWidth = (400 - 16) / 2 = 192

const baseConfig: LayoutSolverConfig = {
  autoFillMode: "on-drop",
  maxColumns: MAX_COLUMNS,
  gap: GAP,
};

// ─── computeLayout with phantom ─────────────────────────────

describe("computeLayout with phantom", () => {
  it("phantom occupies the excluded widget's space and B stays put", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 120],
    ]);

    // Base layout for reference
    const base = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP);
    const baseA = base.positions.get("A")!;
    const baseB = base.positions.get("B")!;

    // Exclude A, insert phantom at A's position
    const result = computeLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      MAX_COLUMNS,
      GAP,
      {
        excludeIds: new Set(["A"]),
        phantom: {
          id: "__phantom_A",
          colSpan: 1,
          height: 100,
          order: 0,
        },
      }
    );

    const phantom = result.positions.get("__phantom_A")!;
    const bPos = result.positions.get("B")!;

    // Phantom should be at A's original position
    expect(phantom.x).toBe(baseA.x);
    expect(phantom.y).toBe(baseA.y);
    expect(phantom.height).toBe(100);

    // B should not have moved
    expect(bPos.x).toBe(baseB.x);
    expect(bPos.y).toBe(baseB.y);
  });

  it("phantom with different colSpan affects layout correctly", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
    ]);

    // Exclude A, insert a 2-column phantom at order 0
    const result = computeLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      MAX_COLUMNS,
      GAP,
      {
        excludeIds: new Set(["A"]),
        phantom: {
          id: "__phantom_A",
          colSpan: 2,
          height: 80,
          order: 0,
        },
      }
    );

    const phantom = result.positions.get("__phantom_A")!;
    const bPos = result.positions.get("B")!;
    const cPos = result.positions.get("C")!;

    // Full-width phantom at top
    expect(phantom.x).toBe(0);
    expect(phantom.y).toBe(0);
    expect(phantom.colSpan).toBe(2);

    // B and C should be pushed below the phantom
    expect(bPos.y).toBe(80 + GAP);
    expect(cPos.y).toBe(80 + GAP);
  });
});

// ─── computeLayout with excludeIds ──────────────────────────

describe("computeLayout with excludeIds", () => {
  it("excluded widget is removed and B repacks to fill the gap", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 120],
    ]);

    const result = computeLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      MAX_COLUMNS,
      GAP,
      { excludeIds: new Set(["A"]) }
    );

    // A should not be in positions
    expect(result.positions.has("A")).toBe(false);

    // B should repack to the first column (x=0, y=0)
    const bPos = result.positions.get("B")!;
    expect(bPos.x).toBe(0);
    expect(bPos.y).toBe(0);
  });

  it("excluding multiple ids works", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
    ]);

    const result = computeLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      MAX_COLUMNS,
      GAP,
      { excludeIds: new Set(["A", "B"]) }
    );

    expect(result.positions.has("A")).toBe(false);
    expect(result.positions.has("B")).toBe(false);

    const cPos = result.positions.get("C")!;
    expect(cPos.x).toBe(0);
    expect(cPos.y).toBe(0);
  });
});

// ─── solveBaseLayout ────────────────────────────────────────

describe("solveBaseLayout", () => {
  it("produces the same result as raw computeLayout", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 2),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 120],
      ["C", 80],
    ]);

    const raw = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP);
    const solved = solveBaseLayout(widgets, heights, CONTAINER_WIDTH, baseConfig);

    expect(solved.totalHeight).toBe(raw.totalHeight);

    for (const [id, pos] of raw.positions) {
      const solvedPos = solved.positions.get(id)!;
      expect(solvedPos.x).toBe(pos.x);
      expect(solvedPos.y).toBe(pos.y);
      expect(solvedPos.width).toBe(pos.width);
      expect(solvedPos.height).toBe(pos.height);
      expect(solvedPos.colSpan).toBe(pos.colSpan);
    }
  });
});

// ─── solveDragLayout ───────────────────────────────────────

describe("solveDragLayout", () => {
  it("on-drop mode: phantom holds position, other widgets stable", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
    ]);

    const base = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP);
    const drag = solveDragLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      { ...baseConfig, autoFillMode: "on-drop" },
      "A"
    );

    // A should not be in positions (excluded)
    expect(drag.positions.has("A")).toBe(false);

    // Phantom should exist at A's original position
    const phantom = drag.positions.get("__phantom_A")!;
    expect(phantom).toBeDefined();
    expect(phantom.x).toBe(base.positions.get("A")!.x);
    expect(phantom.y).toBe(base.positions.get("A")!.y);

    // B should not move
    const bBase = base.positions.get("B")!;
    const bDrag = drag.positions.get("B")!;
    expect(bDrag.x).toBe(bBase.x);
    expect(bDrag.y).toBe(bBase.y);

    // C should not move
    const cBase = base.positions.get("C")!;
    const cDrag = drag.positions.get("C")!;
    expect(cDrag.x).toBe(cBase.x);
    expect(cDrag.y).toBe(cBase.y);
  });

  it("immediate mode: source excluded, others repack", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
    ]);

    const drag = solveDragLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      { ...baseConfig, autoFillMode: "immediate" },
      "A"
    );

    // A should not be in positions
    expect(drag.positions.has("A")).toBe(false);
    // No phantom either
    expect(drag.positions.has("__phantom_A")).toBe(false);

    // B repacks to column 0
    const bPos = drag.positions.get("B")!;
    expect(bPos.x).toBe(0);
    expect(bPos.y).toBe(0);

    // C takes column 1
    const cPos = drag.positions.get("C")!;
    const colWidth = (CONTAINER_WIDTH - GAP * (MAX_COLUMNS - 1)) / MAX_COLUMNS;
    expect(cPos.x).toBe(colWidth + GAP);
    expect(cPos.y).toBe(0);
  });

  it("on-drop mode with missing source falls back to base layout", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
    ]);

    const drag = solveDragLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      { ...baseConfig, autoFillMode: "on-drop" },
      "nonexistent"
    );

    // Should be same as base layout
    const base = solveBaseLayout(widgets, heights, CONTAINER_WIDTH, baseConfig);
    expect(drag.totalHeight).toBe(base.totalHeight);
    expect(drag.positions.size).toBe(base.positions.size);
  });

  it("on-drop mode uses DEFAULT_WIDGET_HEIGHT when height not in map", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    // No height entry for A
    const heights = makeHeights([["B", 100]]);

    const drag = solveDragLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      { ...baseConfig, autoFillMode: "on-drop" },
      "A"
    );

    const phantom = drag.positions.get("__phantom_A")!;
    expect(phantom.height).toBe(DEFAULT_WIDGET_HEIGHT);
  });
});

// ─── solvePreviewLayout ─────────────────────────────────────

describe("solvePreviewLayout", () => {
  it("reorder: shows correct preview positions", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
    ]);

    // Move A to index 2 (after C)
    const preview = solvePreviewLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      baseConfig,
      { type: "reorder", targetIndex: 2 },
      "A"
    );

    // New order should be: B(0), C(1), A(2)
    const aPos = preview.positions.get("A")!;
    const bPos = preview.positions.get("B")!;
    const cPos = preview.positions.get("C")!;

    // B should be at column 0, row 0
    expect(bPos.x).toBe(0);
    expect(bPos.y).toBe(0);

    const colWidth = (CONTAINER_WIDTH - GAP * (MAX_COLUMNS - 1)) / MAX_COLUMNS;
    // C should be at column 1, row 0
    expect(cPos.x).toBe(colWidth + GAP);
    expect(cPos.y).toBe(0);

    // A should be in the next row (column 0)
    expect(aPos.x).toBe(0);
    expect(aPos.y).toBe(100 + GAP);
  });

  it("swap: shows exchanged positions", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 120],
    ]);

    const base = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP);

    const preview = solvePreviewLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      baseConfig,
      { type: "swap", targetId: "B" },
      "A"
    );

    const aPos = preview.positions.get("A")!;
    const bPos = preview.positions.get("B")!;

    // After swap: A gets B's order (1), B gets A's order (0)
    // B now at order 0 -> column 0, A now at order 1 -> column 1
    expect(bPos.x).toBe(base.positions.get("A")!.x);
    expect(bPos.y).toBe(0);
    expect(aPos.x).toBe(base.positions.get("B")!.x);
    expect(aPos.y).toBe(0);
  });

  it("auto-resize: shows both widgets at new spans", () => {
    // 4-column layout so we can resize meaningfully
    const fourColConfig: LayoutSolverConfig = {
      autoFillMode: "on-drop",
      maxColumns: 4,
      gap: GAP,
    };
    const containerWidth = 400;
    // colWidth = (400 - 16*3) / 4 = (400 - 48) / 4 = 88

    const widgets = [
      makeWidget("A", 0, 2),
      makeWidget("B", 1, 2),
      makeWidget("C", 2, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
    ]);

    // Auto-resize: A becomes 1-span, B becomes 1-span, A moves to index 1
    const preview = solvePreviewLayout(
      widgets,
      heights,
      containerWidth,
      fourColConfig,
      {
        type: "auto-resize",
        targetId: "B",
        sourceSpan: 1,
        targetSpan: 1,
        targetIndex: 1,
      },
      "A"
    );

    const aPos = preview.positions.get("A")!;
    const bPos = preview.positions.get("B")!;

    // Both should have colSpan 1
    expect(aPos.colSpan).toBe(1);
    expect(bPos.colSpan).toBe(1);

    // New order: B(0), A(1), C(2) — all with 1-span fit in first row of a 4-col grid
    expect(bPos.y).toBe(0);
    expect(aPos.y).toBe(0);
  });

  it("none intent: same as drag layout", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 120],
    ]);

    const drag = solveDragLayout(widgets, heights, CONTAINER_WIDTH, baseConfig, "A");
    const preview = solvePreviewLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      baseConfig,
      { type: "none" },
      "A"
    );

    expect(preview.totalHeight).toBe(drag.totalHeight);
    for (const [id, pos] of drag.positions) {
      const previewPos = preview.positions.get(id)!;
      expect(previewPos.x).toBe(pos.x);
      expect(previewPos.y).toBe(pos.y);
      expect(previewPos.width).toBe(pos.width);
      expect(previewPos.height).toBe(pos.height);
    }
  });

  it("column-pin: widget is placed at pinned column", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
    ]);

    const colWidth = (CONTAINER_WIDTH - GAP * (MAX_COLUMNS - 1)) / MAX_COLUMNS;

    const preview = solvePreviewLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      baseConfig,
      { type: "column-pin", column: 1 },
      "A"
    );

    const aPos = preview.positions.get("A")!;
    // A should be pinned to column 1
    expect(aPos.x).toBe(1 * (colWidth + GAP));
  });

  it("column-pin: uninvolved widgets stay in their columns when baseLayout provided", () => {
    // Layout: A(span=2) B / C D _  (3 columns, D at col 2 via columnStart)
    // Pin C to column 1 → D should stay at column 2
    const threeColConfig: LayoutSolverConfig = {
      autoFillMode: "on-drop",
      maxColumns: 3,
      gap: GAP,
    };
    const cw = 3 * 100 + 2 * GAP; // 332
    const colWidth = (cw - GAP * 2) / 3; // 100

    const widgets: WidgetState[] = [
      makeWidget("A", 0, 2),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 1),
      { ...makeWidget("D", 3, 1), columnStart: 2 },
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
      ["D", 100],
    ]);

    // Compute base layout: A at cols 0-1, B at col 2, C at col 0, D at col 2 (pinned)
    const base = solveBaseLayout(widgets, heights, cw, threeColConfig);
    expect(base.positions.get("D")!.x).toBe(2 * (colWidth + GAP));

    // Now preview column-pin C to column 1, passing baseLayout
    const preview = solvePreviewLayout(
      widgets,
      heights,
      cw,
      threeColConfig,
      { type: "column-pin", column: 1 },
      "C",
      base
    );

    const cPos = preview.positions.get("C")!;
    const dPos = preview.positions.get("D")!;

    // C should be pinned to column 1
    expect(cPos.x).toBe(1 * (colWidth + GAP));

    // D should stay at column 2 (already has columnStart=2), not move
    expect(dPos.x).toBe(2 * (colWidth + GAP));
  });

  it("column-pin: stabilizes widgets without columnStart using baseLayout", () => {
    // Verify that stabilize pins unpinned widgets to their base positions
    // A and B on row 0, C is dragged → B should not move
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
      makeWidget("C", 2, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
      ["C", 100],
    ]);

    const colWidth = (CONTAINER_WIDTH - GAP * (MAX_COLUMNS - 1)) / MAX_COLUMNS;
    const base = solveBaseLayout(widgets, heights, CONTAINER_WIDTH, baseConfig);

    // B is at column 1 in base
    expect(base.positions.get("B")!.x).toBe(colWidth + GAP);

    // Pin C to column 1 (conflicts with B's greedy position)
    const preview = solvePreviewLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      baseConfig,
      { type: "column-pin", column: 1 },
      "C",
      base
    );

    // B should be stabilized at column 1 (its base position)
    const bPos = preview.positions.get("B")!;
    expect(bPos.x).toBe(colWidth + GAP);
  });

  it("reorder with missing source falls back to drag layout", () => {
    const widgets = [
      makeWidget("A", 0, 1),
      makeWidget("B", 1, 1),
    ];
    const heights = makeHeights([
      ["A", 100],
      ["B", 100],
    ]);

    const preview = solvePreviewLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      baseConfig,
      { type: "reorder", targetIndex: 0 },
      "nonexistent"
    );

    // Should fall back to drag layout
    const drag = solveDragLayout(widgets, heights, CONTAINER_WIDTH, baseConfig, "nonexistent");
    expect(preview.totalHeight).toBe(drag.totalHeight);
  });
});
