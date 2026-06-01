import { describe, it, expect } from "vitest";
import { computeInsertionLines } from "../insertion-lines.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";

function layout(
  positions: Array<{ id: string; x: number; y: number; width: number; height: number; colSpan: number }>,
): ComputedLayout {
  return {
    positions: new Map(positions.map((p) => [p.id, { ...p }])),
    totalHeight: Math.max(0, ...positions.map((p) => p.y + p.height)),
  };
}

function widget(id: string, colSpan: number, order: number): WidgetState {
  return { id, type: "x", colSpan, visible: true, order };
}

describe("computeInsertionLines — disabledReason", () => {
  it("classifies a full-width-only source as 'only-full-width' on infeasible V-lines", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 }]);
    const lines = computeInsertionLines({
      layout: lay,
      widgets: [widget("a", 1, 0), widget("src", 2, 1)],
      sourceId: "src",
      dropMode: "lines",
      maxColumns: 2,
      containerWidth: 528,
      isPositionLocked: () => false,
      isResizeLocked: () => false,
      getWidgetConstraints: (id) =>
        id === "src" ? { minSpan: 2, maxSpan: 2 } : { minSpan: 1, maxSpan: 2 },
    });

    const vLines = lines.filter((l) => l.orientation === "vertical");
    expect(vLines.length).toBeGreaterThan(0);
    for (const l of vLines) {
      expect(l.disabled).toBe(true);
      expect(l.disabledReason).toBe("only-full-width");
    }

    // A full-width widget still fits a new row, so H-lines carry no reason.
    const hLines = lines.filter((l) => l.orientation === "horizontal");
    for (const l of hLines) {
      expect(l.disabledReason).toBeUndefined();
    }
  });

  it("classifies 'resize-locked' when a stationary locked widget can't make room", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 528, height: 100, colSpan: 2 }]);
    const lines = computeInsertionLines({
      layout: lay,
      widgets: [widget("a", 2, 0), widget("src", 1, 1)],
      sourceId: "src",
      dropMode: "lines",
      maxColumns: 2,
      containerWidth: 528,
      isPositionLocked: () => false,
      isResizeLocked: (id) => id === "a",
      getWidgetConstraints: () => ({ minSpan: 1, maxSpan: 2 }),
    });

    const vLines = lines.filter((l) => l.orientation === "vertical" && l.disabled);
    expect(vLines.length).toBeGreaterThan(0);
    for (const l of vLines) {
      expect(l.disabledReason).toBe("resize-locked");
    }
  });

  it("leaves disabledReason undefined for self-adjacent (no-op) lines", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "src", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const lines = computeInsertionLines({
      layout: lay,
      widgets: [widget("a", 1, 0), widget("src", 1, 1)],
      sourceId: "src",
      dropMode: "lines",
      maxColumns: 2,
      containerWidth: 528,
      isPositionLocked: () => false,
      isResizeLocked: () => false,
      getWidgetConstraints: () => ({ minSpan: 1, maxSpan: 2 }),
    });

    // The row fits the source, so any disabled line is disabled only because it
    // is adjacent/self-adjacent — never an infeasibility — and carries no reason.
    for (const l of lines) {
      if (l.disabled) expect(l.disabledReason).toBeUndefined();
    }
  });

  it("classifies crossing a position-locked widget as 'position-locked'", () => {
    const lay = layout([
      { id: "src", x: 0, y: 0, width: 176, height: 100, colSpan: 1 },
      { id: "a", x: 192, y: 0, width: 176, height: 100, colSpan: 1 },
      { id: "b", x: 384, y: 0, width: 176, height: 100, colSpan: 1 },
    ]);
    const lines = computeInsertionLines({
      layout: lay,
      widgets: [widget("src", 1, 0), widget("a", 1, 1), widget("b", 1, 2)],
      sourceId: "src",
      dropMode: "lines",
      maxColumns: 3,
      containerWidth: 560,
      isPositionLocked: (id) => id === "a",
      isResizeLocked: () => false,
      getWidgetConstraints: () => ({ minSpan: 1, maxSpan: 3 }),
    });

    // Moving src past the locked widget "a" (e.g. to after b) crosses the lock.
    const crossing = lines.filter((l) => l.disabledReason === "position-locked");
    expect(crossing.length).toBeGreaterThan(0);
  });
});
