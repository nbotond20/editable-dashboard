import { describe, it, expect } from "vitest";
import { computeLayout } from "../../layout/compute-layout.ts";
import { solvePreviewLayout, findColumnPinInsertionIndex } from "../layout-solver.ts";
import type { WidgetState } from "../../types.ts";
import { DragEngine } from "../drag-engine.ts";

/**
 * Regression test for column-pin preview not updating when the pointer
 * moves vertically within the same column.
 *
 * Layout: A x / B B / C D  (2-column grid)
 *
 * When dragging D upward from (col 1, row 2) toward (col 1, row 0),
 * the engine first detects the empty zone at column 1 near row 2's Y,
 * producing "column-pin column 1" with a high pointerY.  As the pointer
 * continues to row 0, the intent stays "column-pin column 1" but the
 * preview must update to place D at row 0 — not remain at row 2.
 */
describe("column-pin preview updates as pointer moves vertically", () => {
  const maxColumns = 2;
  const gap = 16;
  const containerWidth = 800;
  const colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns;

  const widgets: WidgetState[] = [
    { id: "a", type: "t", colSpan: 1, visible: true, order: 0 },
    { id: "bb", type: "t", colSpan: 2, visible: true, order: 1 },
    { id: "c", type: "t", colSpan: 1, visible: true, order: 2 },
    { id: "d", type: "t", colSpan: 1, visible: true, order: 3 },
  ];

  const heights = new Map<string, number>([
    ["a", 300], ["bb", 200], ["c", 250], ["d", 250],
  ]);

  const baseLayout = computeLayout(widgets, heights, containerWidth, maxColumns, gap, { stableColumns: true });

  it("findColumnPinInsertionIndex varies with pointerY", () => {
    const remaining = widgets.filter(w => w.id !== "d" && w.visible).sort((a, b) => a.order - b.order);
    
    // At a low pointerY (row 0), insertion should be early
    const idxAtRow0 = findColumnPinInsertionIndex(remaining, 1, 100, maxColumns, gap, heights, baseLayout);
    // At a high pointerY (below all widgets), insertion should be at end
    const cPos = baseLayout.positions.get("c")!;
    const idxAtRow2 = findColumnPinInsertionIndex(remaining, 1, cPos.y + 50, maxColumns, gap, heights, baseLayout);

    expect(idxAtRow0).toBeLessThan(idxAtRow2);
  });

  it("preview places D at row 0 when pointerY is in row 0", () => {
    const aPos = baseLayout.positions.get("a")!;

    const preview = solvePreviewLayout(
      widgets, heights, containerWidth,
      { autoFillMode: "on-drop", maxColumns, gap },
      { type: "column-pin", column: 1, pointerY: aPos.y + aPos.height / 2 },
      "d", baseLayout,
    );

    const dPos = preview.positions.get("d")!;
    expect(dPos.y).toBe(0);
    expect(dPos.x).toBe(colWidth + gap);
  });

  it("preview places D at row 2 when pointerY is in row 2", () => {
    const cPos = baseLayout.positions.get("c")!;

    const preview = solvePreviewLayout(
      widgets, heights, containerWidth,
      { autoFillMode: "on-drop", maxColumns, gap },
      { type: "column-pin", column: 1, pointerY: cPos.y + 50 },
      "d", baseLayout,
    );

    const dPos = preview.positions.get("d")!;
    expect(dPos.y).toBeGreaterThan(0);
  });

  it("DragEngine updates preview when pointer moves from row 2 to row 0", () => {
    const engine = new DragEngine(
      { widgets, maxColumns, gap, containerWidth: 0 },
      { maxColumns, gap, autoFillMode: "on-drop" },
    );

    engine.send({ type: "SET_CONTAINER", width: containerWidth });
    engine.send({ type: "SET_HEIGHTS", heights });

    const dPos = baseLayout.positions.get("d")!;
    const aPos = baseLayout.positions.get("a")!;

    // Start drag at D's position
    engine.send({
      type: "POINTER_DOWN",
      id: "d",
      position: { x: dPos.x + dPos.width / 2, y: dPos.y + dPos.height / 2 },
      timestamp: 0,
      pointerType: "mouse",
    });

    // Move past activation threshold
    engine.send({
      type: "POINTER_MOVE",
      position: { x: dPos.x + dPos.width / 2, y: dPos.y + dPos.height / 2 - 20 },
      timestamp: 10,
    });

    // Tick to activate
    engine.send({ type: "TICK", timestamp: 20 });

    // Move to empty cell near row 2 (column 1, high Y)
    const emptyCol1NearRow2 = { x: colWidth + gap + colWidth / 2, y: dPos.y - 10 };
    engine.send({ type: "POINTER_MOVE", position: emptyCol1NearRow2, timestamp: 30 });
    // Multiple ticks to settle zone debounce
    for (let t = 40; t <= 200; t += 16) {
      engine.send({ type: "TICK", timestamp: t });
    }

    const snap1 = engine.getSnapshot();
    const d1 = snap1.previewLayout?.positions.get("d");

    // Now move to empty cell near row 0 (column 1, low Y)
    const emptyCol1NearRow0 = { x: colWidth + gap + colWidth / 2, y: aPos.y + aPos.height / 2 };
    engine.send({ type: "POINTER_MOVE", position: emptyCol1NearRow0, timestamp: 300 });
    for (let t = 310; t <= 500; t += 16) {
      engine.send({ type: "TICK", timestamp: t });
    }

    const snap2 = engine.getSnapshot();
    const d2 = snap2.previewLayout?.positions.get("d");

    expect(d2).toBeDefined();
    // The key assertion: D should now be at row 0 (y=0), not stuck at row 2
    expect(d2!.y).toBe(0);

    // Verify it actually changed from the original position
    if (d1) {
      expect(d2!.y).toBeLessThan(d1.y);
    }

    engine.destroy();
  });
});
