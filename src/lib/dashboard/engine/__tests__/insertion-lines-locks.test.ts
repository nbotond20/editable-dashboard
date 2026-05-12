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

function widget(id: string, colSpan: number, order: number): WidgetState {
  return { id, type: "x", colSpan, visible: true, order };
}

const BASE = {
  maxColumns: 3,
  containerWidth: 800,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
};

describe("computeInsertionLines — locks & constraints", () => {
  it("disables V-lines in a row where a stationary widget is resize-locked and row is full", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "c", x: 544, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets = [widget("a", 1, 0), widget("b", 1, 1), widget("c", 1, 2), widget("src", 1, 3)];
    const result = computeInsertionLines({
      ...BASE,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      isResizeLocked: (id) => id === "a",
    });
    const vLines = result.filter((l) => l.orientation === "vertical");
    expect(vLines.length).toBeGreaterThan(0);
    expect(vLines.every((l) => l.disabled)).toBe(true);
  });

  it("enables V-lines when row has spare capacity even if a stationary is resize-locked", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets = [widget("a", 1, 0), widget("b", 1, 1), widget("src", 1, 2)];
    const result = computeInsertionLines({
      ...BASE,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      isResizeLocked: (id) => id === "a",
    });
    const midLine = result.find(
      (l) => l.orientation === "vertical" && l.beforeId === "a" && l.afterId === "b"
    );
    expect(midLine?.disabled).toBe(false);
  });

  it("disables V-lines when source is resize-locked and would need to shrink", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 512, height: 100, colSpan: 2 },
      { id: "b", x: 528, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets = [widget("a", 2, 0), widget("b", 1, 1), widget("src", 2, 2)];
    const result = computeInsertionLines({
      ...BASE,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      isResizeLocked: (id) => id === "src",
    });
    const vLines = result.filter((l) => l.orientation === "vertical");
    expect(vLines.every((l) => l.disabled)).toBe(true);
  });

  it("disables V-lines when a stationary's minSpan would be violated by equal-distribute", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 512, height: 100, colSpan: 2 },
      { id: "b", x: 528, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets = [widget("a", 2, 0), widget("b", 1, 1), widget("src", 2, 2)];
    const result = computeInsertionLines({
      ...BASE,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      getWidgetConstraints: (id) => (id === "a" ? { minSpan: 2, maxSpan: 3 } : { minSpan: 1, maxSpan: 3 }),
    });
    const vLines = result.filter((l) => l.orientation === "vertical");
    expect(vLines.every((l) => l.disabled)).toBe(true);
  });

  it("disables H-line above a position-locked widget that sits between source and target", () => {
    const lay = layout([
      { id: "src", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "locked", x: 0, y: 116, width: 256, height: 100, colSpan: 1 },
      { id: "c", x: 0, y: 232, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets = [widget("src", 1, 0), widget("locked", 1, 1), widget("c", 1, 2)];
    const result = computeInsertionLines({
      ...BASE,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      isPositionLocked: (id) => id === "locked",
    });
    const hAfterC = result.find(
      (l) => l.orientation === "horizontal" && l.beforeId === "c" && l.afterId === null
    );
    expect(hAfterC?.disabled).toBe(true);
  });

  it("disables H-line when source is resize-locked and current span exceeds maxColumns", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "src", x: 0, y: 116, width: 800, height: 100, colSpan: 4 },
    ]);
    const widgets = [widget("a", 1, 0), { id: "src", type: "x", colSpan: 4, visible: true, order: 1 }];
    const result = computeInsertionLines({
      ...BASE,
      maxColumns: 3,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      isResizeLocked: (id) => id === "src",
    });
    const hLines = result.filter((l) => l.orientation === "horizontal");
    expect(hLines.every((l) => l.disabled)).toBe(true);
  });

  it("keeps H-line enabled when source is resize-locked but current span fits", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "src", x: 0, y: 116, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets = [widget("a", 1, 0), widget("src", 1, 1)];
    const result = computeInsertionLines({
      ...BASE,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      isResizeLocked: (id) => id === "src",
    });
    const hTop = result.find(
      (l) => l.orientation === "horizontal" && l.beforeId === null && l.afterId === "a"
    );
    expect(hTop?.disabled).toBe(false);
  });

  it("disables V-line when reordering would cross a position-locked widget", () => {
    const lay = layout([
      { id: "src", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "locked", x: 0, y: 116, width: 256, height: 100, colSpan: 1 },
      { id: "c", x: 0, y: 232, width: 256, height: 100, colSpan: 1 },
    ]);
    const widgets = [widget("src", 1, 0), widget("locked", 1, 1), widget("c", 1, 2)];
    const result = computeInsertionLines({
      ...BASE,
      layout: lay,
      widgets,
      sourceId: "src",
      dropMode: "lines",
      isPositionLocked: (id) => id === "locked",
    });
    const vAfterC = result.find(
      (l) => l.orientation === "vertical" && l.beforeId === "c" && l.afterId === null
    );
    expect(vAfterC?.disabled).toBe(true);
  });
});
