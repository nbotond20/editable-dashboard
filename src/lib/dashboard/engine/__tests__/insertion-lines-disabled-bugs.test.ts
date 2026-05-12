import { describe, it, expect } from "vitest";
import { computeInsertionLines } from "../insertion-lines.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";

function layout(
  positions: Array<{ id: string; x: number; y: number; width: number; height: number; colSpan: number }>,
  totalHeight?: number
): ComputedLayout {
  const map = new Map(
    positions.map((p) => [p.id, { id: p.id, x: p.x, y: p.y, width: p.width, height: p.height, colSpan: p.colSpan }])
  );
  return {
    positions: map,
    totalHeight: totalHeight ?? Math.max(0, ...positions.map((p) => p.y + p.height)),
  };
}

const CONFIG = {
  maxColumns: 2,
  containerWidth: 528,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
};

describe("computeInsertionLines — disable regression bugs", () => {
  it("H-line between source's row and a row below is NOT disabled (becomes new full-width row)", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "src", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 0, y: 116, width: 528, height: 100, colSpan: 2 },
      { id: "c", x: 0, y: 232, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets: WidgetState[] = [
      { id: "a", type: "x", colSpan: 1, visible: true, order: 0 },
      { id: "src", type: "x", colSpan: 1, visible: true, order: 1 },
      { id: "b", type: "x", colSpan: 2, visible: true, order: 2 },
      { id: "c", type: "x", colSpan: 1, visible: true, order: 3 },
    ];
    const result = computeInsertionLines({
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const line = result.find(
      (l) => l.orientation === "horizontal" && l.beforeId === "a" && l.afterId === "b"
    );
    expect(line).toBeDefined();
    expect(line!.disabled).toBe(false);
  });

  it("V-line at right end of a single-widget row points at next row's first widget (not end of list)", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 0, y: 116, width: 528, height: 100, colSpan: 2 },
      { id: "c", x: 0, y: 232, width: 256, height: 100, colSpan: 1 },
      { id: "src", x: 272, y: 232, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets: WidgetState[] = [
      { id: "a", type: "x", colSpan: 1, visible: true, order: 0 },
      { id: "b", type: "x", colSpan: 2, visible: true, order: 1 },
      { id: "c", type: "x", colSpan: 1, visible: true, order: 2 },
      { id: "src", type: "x", colSpan: 1, visible: true, order: 3 },
    ];
    const result = computeInsertionLines({
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const line = result.find(
      (l) => l.orientation === "vertical" && l.beforeId === "a" && l.afterId === null
    );
    expect(line).toBeDefined();
    expect(line!.insertionIndex).toBe(1);
    expect(line!.disabled).toBe(false);
  });

  it("V-line at right of single-widget row is enabled when source from below needs resize to fit (A X / B B)", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 0, y: 116, width: 528, height: 100, colSpan: 2 },
    ]);
    const widgets: WidgetState[] = [
      { id: "a", type: "x", colSpan: 1, visible: true, order: 0 },
      { id: "b", type: "x", colSpan: 2, visible: true, order: 1 },
    ];
    const result = computeInsertionLines({
      layout: lay,
      widgets,
      sourceId: "b",
      dropMode: "lines",
      ...CONFIG,
    });
    const line = result.find(
      (l) => l.orientation === "vertical" && l.beforeId === "a" && l.afterId === null
    );
    expect(line).toBeDefined();
    expect(line!.disabled).toBe(false);
  });
});
