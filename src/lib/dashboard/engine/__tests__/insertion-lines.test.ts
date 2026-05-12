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

function widgets(ids: string[]): WidgetState[] {
  return ids.map((id, i) => ({ id, type: "x", colSpan: 1, visible: true, order: i }));
}

const CONFIG = {
  maxColumns: 3,
  containerWidth: 800,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
};

describe("computeInsertionLines", () => {
  it("returns empty array in classic mode", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 }]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a"]),
      sourceId: "a",
      dropMode: "classic",
      ...CONFIG,
    });
    expect(result).toEqual([]);
  });

  it("returns empty array when source is position-locked", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 }]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a"]),
      sourceId: "a",
      dropMode: "lines",
      ...CONFIG,
      isPositionLocked: (id) => id === "a",
    });
    expect(result).toEqual([]);
  });

  it("emits 4 V-lines + 2 H-lines for a single-row layout with 3 stationaries", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "c", x: 544, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a", "b", "c", "src"]),
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const h = result.filter((l) => l.orientation === "horizontal");
    const v = result.filter((l) => l.orientation === "vertical");
    expect(h.length).toBe(2);
    expect(v.length).toBe(4);
  });

  it("emits no V-lines in 1-column mode", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 800, height: 100, colSpan: 1 },
      { id: "b", x: 0, y: 116, width: 800, height: 100, colSpan: 1 },
    ]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a", "b", "src"]),
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
      maxColumns: 1,
    });
    expect(result.every((l) => l.orientation === "horizontal")).toBe(true);
    expect(result.length).toBe(3);
  });

  it("emits one H-line at top when dashboard is empty", () => {
    const result = computeInsertionLines({
      layout: layout([]),
      widgets: [],
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    expect(result.length).toBe(1);
    expect(result[0].orientation).toBe("horizontal");
  });

  it("flags self-adjacent V-lines as disabled", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const allWidgets: WidgetState[] = [
      { id: "src", type: "x", colSpan: 1, visible: true, order: 0 },
      { id: "a", type: "x", colSpan: 1, visible: true, order: 1 },
      { id: "b", type: "x", colSpan: 1, visible: true, order: 2 },
    ];
    const result = computeInsertionLines({
      layout: lay,
      widgets: allWidgets,
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const lineBeforeA = result.find((l) => l.orientation === "vertical" && l.beforeId === null && l.afterId === "a");
    expect(lineBeforeA?.disabled).toBe(true);
  });

  it("emits stable ids derived from before/after ids and rowIndex", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a", "b", "src"]),
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const ids = result.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
