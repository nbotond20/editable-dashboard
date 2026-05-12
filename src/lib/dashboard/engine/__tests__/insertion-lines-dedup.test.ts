import { describe, it, expect } from "vitest";
import { computeInsertionLines } from "../insertion-lines.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";

function layout(
  positions: Array<{ id: string; x: number; y: number; width: number; height: number; colSpan: number }>
): ComputedLayout {
  return {
    positions: new Map(
      positions.map((p) => [p.id, { id: p.id, x: p.x, y: p.y, width: p.width, height: p.height, colSpan: p.colSpan }])
    ),
    totalHeight: Math.max(0, ...positions.map((p) => p.y + p.height)),
  };
}

const CFG = {
  maxColumns: 2,
  containerWidth: 800,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
};

describe("computeInsertionLines — overlapping segment dedup", () => {
  it("drops shorter h-segments that are fully contained by a longer one in the same line", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 392, height: 100, colSpan: 1 },
      { id: "b", x: 408, y: 0, width: 392, height: 140, colSpan: 1 },
      { id: "c", x: 0, y: 156, width: 800, height: 100, colSpan: 2 },
    ]);
    const ws: WidgetState[] = [
      { id: "a", type: "x", colSpan: 1, visible: true, order: 0 },
      { id: "b", type: "x", colSpan: 1, visible: true, order: 1 },
      { id: "c", type: "x", colSpan: 2, visible: true, order: 2 },
    ];

    const lines = computeInsertionLines({
      layout: lay,
      widgets: ws,
      sourceId: null,
      dropMode: "lines",
      ...CFG,
    });

    const hMidLine = lines.find((l) => l.orientation === "horizontal" && l.rowIndex === 1);
    expect(hMidLine).toBeDefined();
    const segs = hMidLine!.segments!;
    expect(segs.length).toBe(1);
    const seg = segs[0];
    expect(seg.anchorId).toBe("c");
    expect(seg.x2 - seg.x1).toBeGreaterThan(700);
  });

  it("keeps both segments side-by-side when neither contains the other", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 392, height: 100, colSpan: 1 },
      { id: "b", x: 408, y: 0, width: 392, height: 100, colSpan: 1 },
    ]);
    const ws: WidgetState[] = [
      { id: "a", type: "x", colSpan: 1, visible: true, order: 0 },
      { id: "b", type: "x", colSpan: 1, visible: true, order: 1 },
    ];

    const lines = computeInsertionLines({
      layout: lay,
      widgets: ws,
      sourceId: null,
      dropMode: "lines",
      ...CFG,
    });

    const topHLine = lines.find((l) => l.orientation === "horizontal" && l.rowIndex === 0);
    expect(topHLine).toBeDefined();
    const segs = topHLine!.segments!;
    expect(segs.length).toBe(2);
    const anchors = segs.map((s) => s.anchorId).sort();
    expect(anchors).toEqual(["a", "b"]);
  });

  it("dedupes equal-range segments — keeps exactly one", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 800, height: 100, colSpan: 2 },
      { id: "b", x: 0, y: 116, width: 800, height: 100, colSpan: 2 },
    ]);
    const ws: WidgetState[] = [
      { id: "a", type: "x", colSpan: 2, visible: true, order: 0 },
      { id: "b", type: "x", colSpan: 2, visible: true, order: 1 },
    ];

    const lines = computeInsertionLines({
      layout: lay,
      widgets: ws,
      sourceId: null,
      dropMode: "lines",
      ...CFG,
    });

    const midHLine = lines.find((l) => l.orientation === "horizontal" && l.rowIndex === 1);
    expect(midHLine).toBeDefined();
    expect(midHLine!.segments!.length).toBe(1);
  });
});
