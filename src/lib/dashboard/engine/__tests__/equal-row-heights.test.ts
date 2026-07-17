import { describe, it, expect } from "vitest";
import { computeLayout } from "../../layout/compute-layout.ts";
import { solvePreviewLayout, type LayoutSolverConfig } from "../layout-solver.ts";
import type { WidgetState } from "../../types.ts";
import { DEFAULT_WIDGET_HEIGHT } from "../../constants.ts";

function makeWidget(id: string, order: number, colSpan = 1, visible = true): WidgetState {
  return { id, type: "test", colSpan, visible, order };
}

const CONTAINER_WIDTH = 400;
const MAX_COLUMNS = 2;
const GAP = 16;
const COL_WIDTH = (CONTAINER_WIDTH - GAP * (MAX_COLUMNS - 1)) / MAX_COLUMNS; // 192

const equalOpts = { equalRowHeights: true } as const;

describe("computeLayout equalRowHeights", () => {
  it("gives both widgets in a row the tallest member's height, aligned at the same y", () => {
    const widgets = [makeWidget("A", 0), makeWidget("B", 1)];
    const heights = new Map([
      ["A", 100],
      ["B", 150],
    ]);

    const layout = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP, equalOpts);
    const a = layout.positions.get("A")!;
    const b = layout.positions.get("B")!;

    expect(a.height).toBe(150);
    expect(b.height).toBe(150);
    expect(a.y).toBe(0);
    expect(b.y).toBe(0);
    expect(a.x).toBe(0);
    expect(b.x).toBe(COL_WIDTH + GAP); // 208
    expect(layout.totalHeight).toBe(150);
  });

  it("stacks rows below the equalized previous row and sums totalHeight", () => {
    const widgets = [makeWidget("A", 0), makeWidget("B", 1), makeWidget("C", 2), makeWidget("D", 3)];
    const heights = new Map([
      ["A", 100],
      ["B", 150],
      ["C", 80],
      ["D", 90],
    ]);

    const layout = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP, equalOpts);
    const c = layout.positions.get("C")!;
    const d = layout.positions.get("D")!;

    // row 0 height 150 → row 1 top = 150 + gap
    expect(c.y).toBe(150 + GAP); // 166
    expect(d.y).toBe(150 + GAP);
    expect(c.height).toBe(90);
    expect(d.height).toBe(90);
    // total = 150 + gap + 90
    expect(layout.totalHeight).toBe(150 + GAP + 90); // 256
  });

  it("puts a full-width widget in its own row", () => {
    const widgets = [makeWidget("A", 0, 2), makeWidget("B", 1), makeWidget("C", 2)];
    const heights = new Map([
      ["A", 100],
      ["B", 50],
      ["C", 70],
    ]);

    const layout = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP, equalOpts);
    const a = layout.positions.get("A")!;
    const b = layout.positions.get("B")!;
    const c = layout.positions.get("C")!;

    expect(a.width).toBe(CONTAINER_WIDTH); // full width
    expect(a.y).toBe(0);
    expect(a.height).toBe(100);
    expect(b.y).toBe(100 + GAP); // 116
    expect(c.y).toBe(100 + GAP);
    expect(b.height).toBe(70);
    expect(c.height).toBe(70);
  });

  it("uses the default height for widgets without a measured height", () => {
    const widgets = [makeWidget("A", 0), makeWidget("B", 1)];
    const heights = new Map([["B", 100]]);

    const layout = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP, equalOpts);

    expect(layout.positions.get("A")!.height).toBe(DEFAULT_WIDGET_HEIGHT);
    expect(layout.positions.get("B")!.height).toBe(DEFAULT_WIDGET_HEIGHT);
  });

  it("lets a phantom participate in its row's height equalization", () => {
    const widgets = [makeWidget("A", 0)];
    const heights = new Map([["A", 100]]);

    const layout = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP, {
      ...equalOpts,
      phantom: { id: "__p", colSpan: 1, height: 300, order: 1 },
    });

    expect(layout.positions.get("A")!.height).toBe(300);
    expect(layout.positions.get("__p")!.height).toBe(300);
    expect(layout.positions.get("A")!.y).toBe(0);
    expect(layout.positions.get("__p")!.y).toBe(0);
  });

  it("ignores columnStart hints — placement follows order", () => {
    const widgets = [
      { ...makeWidget("A", 0), columnStart: 1 },
      { ...makeWidget("B", 1), columnStart: 0 },
    ];
    const heights = new Map([
      ["A", 100],
      ["B", 100],
    ]);

    const layout = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP, equalOpts);

    // order wins: A first (x 0), B second (x 208), despite columnStart hints
    expect(layout.positions.get("A")!.x).toBe(0);
    expect(layout.positions.get("B")!.x).toBe(COL_WIDTH + GAP);
  });

  it("does not equalize when the option is off (masonry stays staggered)", () => {
    const widgets = [makeWidget("A", 0), makeWidget("B", 1), makeWidget("C", 2)];
    const heights = new Map([
      ["A", 100],
      ["B", 150],
      ["C", 40],
    ]);

    const masonry = computeLayout(widgets, heights, CONTAINER_WIDTH, MAX_COLUMNS, GAP);
    // In masonry, C packs under the shorter column A (y=116), not below the tallest row.
    expect(masonry.positions.get("C")!.y).toBe(100 + GAP);
    // heights are not equalized
    expect(masonry.positions.get("A")!.height).toBe(100);
    expect(masonry.positions.get("B")!.height).toBe(150);
  });
});

describe("solvePreviewLayout threads equalRowHeights", () => {
  const config: LayoutSolverConfig = {
    autoFillMode: "on-drop",
    maxColumns: MAX_COLUMNS,
    gap: GAP,
    equalRowHeights: true,
  };

  it("reorder preview produces equal-height rows", () => {
    const widgets = [makeWidget("A", 0), makeWidget("B", 1), makeWidget("C", 2)];
    const heights = new Map([
      ["A", 100],
      ["B", 150],
      ["C", 200],
    ]);

    const preview = solvePreviewLayout(
      widgets,
      heights,
      CONTAINER_WIDTH,
      config,
      { type: "reorder", targetIndex: 0 },
      "C",
    );

    // C moved to front → row 0 is [C, A], equalized to 200
    const c = preview.positions.get("C")!;
    const a = preview.positions.get("A")!;
    expect(c.y).toBe(0);
    expect(a.y).toBe(0);
    expect(c.height).toBe(200);
    expect(a.height).toBe(200);
  });
});
