import { describe, it, expect } from "vitest";
import { resolveIntent } from "../intent-resolver.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";
import type { DropZone } from "../types.ts";

function widget(id: string, colSpan = 1, order = 0): WidgetState {
  return { id, type: "x", colSpan, visible: true, order };
}

function layout(specs: Array<{ id: string; x: number; y: number; w: number; h: number }>): ComputedLayout {
  return {
    positions: new Map(specs.map((s) => [s.id, { id: s.id, x: s.x, y: s.y, width: s.w, height: s.h, colSpan: 1 }])),
    totalHeight: Math.max(0, ...specs.map((s) => s.y + s.h)),
  };
}

const CFG = {
  swapDwellMs: 0,
  resizeDwellMs: 600,
  emptyRowMaximizeDwellMs: 600,
  maxColumns: 3,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
  canDrop: () => true,
  getWidgetConstraints: () => ({ minSpan: 1, maxSpan: 3 }),
};

describe("resolveIntent — deferred swap in lines/both mode", () => {
  it("returns deferred-swap for widget zone in lines mode", () => {
    const zone: DropZone = { type: "widget", targetId: "a", side: "left" };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a")], { ...CFG, dropMode: "lines" });
    expect(result).toEqual({ type: "deferred-swap", targetId: "a" });
  });

  it("returns deferred-swap for widget zone in both mode", () => {
    const zone: DropZone = { type: "widget", targetId: "a", side: "right" };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a")], { ...CFG, dropMode: "both" });
    expect(result).toEqual({ type: "deferred-swap", targetId: "a" });
  });

  it("returns none for position-locked target in lines mode", () => {
    const zone: DropZone = { type: "widget", targetId: "a", side: "left" };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a")], {
      ...CFG,
      dropMode: "lines",
      isPositionLocked: (id) => id === "a",
    });
    expect(result).toEqual({ type: "none" });
  });

  it("ignores dwell time in deferred-swap (no progressive trigger)", () => {
    const zone: DropZone = { type: "widget", targetId: "a", side: "left" };
    const source = widget("src", 1, 5);
    const noDwell = resolveIntent(zone, 0, source, [widget("a")], { ...CFG, dropMode: "lines" });
    const longDwell = resolveIntent(zone, 5000, source, [widget("a")], { ...CFG, dropMode: "lines" });
    expect(noDwell).toEqual(longDwell);
    expect(noDwell.type).toBe("deferred-swap");
  });

  it("preserves classic swap behavior when dropMode is classic", () => {
    const zone: DropZone = { type: "widget", targetId: "a", side: "left" };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a")], { ...CFG, dropMode: "classic" });
    expect(result.type).toBe("swap");
  });
});

describe("resolveIntent — insertion-line zones", () => {
  it("returns new-row intent for insertion-line-h with maxColumns colSpan", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 1,
      beforeId: "a", afterId: "b",
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a"), widget("b")], CFG);
    expect(result).toEqual({ type: "new-row", insertionIndex: 1, colSpan: 3 });
  });

  it("clamps new-row colSpan to source maxSpan", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 0,
      beforeId: null, afterId: "a",
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a")], {
      ...CFG,
      getWidgetConstraints: (id) => (id === "src" ? { minSpan: 1, maxSpan: 2 } : { minSpan: 1, maxSpan: 3 }),
    });
    expect(result).toEqual({ type: "new-row", insertionIndex: 0, colSpan: 2 });
  });

  it("returns in-row-insert with empty resize when row fits without resize", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 256, h: 100 },
    ]);
    const zone: DropZone = {
      type: "insertion-line-v",
      lineId: "v",
      insertionIndex: 1,
      beforeId: "a", afterId: null,
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a", 1, 0)], { ...CFG, layout: lay });
    expect(result).toEqual({ type: "in-row-insert", insertionIndex: 1, resize: [] });
  });

  it("returns in-row-insert with resize when row overflows", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 512, h: 100 },
      { id: "b", x: 528, y: 0, w: 256, h: 100 },
    ]);
    const zone: DropZone = {
      type: "insertion-line-v",
      lineId: "v",
      insertionIndex: 1,
      beforeId: "a", afterId: "b",
    };
    const source = widget("src", 2, 5);
    const result = resolveIntent(zone, 0, source, [widget("a", 2, 0), widget("b", 1, 1)], { ...CFG, layout: lay });
    expect(result.type).toBe("in-row-insert");
    if (result.type === "in-row-insert") {
      const ids = result.resize.map((r) => r.id).sort();
      expect(ids).toEqual(["a", "src"]);
      expect(result.resize.every((r) => r.newSpan === 1)).toBe(true);
      expect(result.insertionIndex).toBe(1);
    }
  });

  it("returns none when equal-distribute is infeasible", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 512, h: 100 },
      { id: "b", x: 528, y: 0, w: 256, h: 100 },
    ]);
    const zone: DropZone = {
      type: "insertion-line-v",
      lineId: "v",
      insertionIndex: 1,
      beforeId: "a", afterId: "b",
    };
    const source = widget("src", 2, 5);
    const result = resolveIntent(zone, 0, source, [widget("a", 2, 0), widget("b", 1, 1)], {
      ...CFG, layout: lay,
      getWidgetConstraints: (id) => (id === "a" ? { minSpan: 2, maxSpan: 3 } : { minSpan: 1, maxSpan: 3 }),
    });
    expect(result).toEqual({ type: "none" });
  });
});
