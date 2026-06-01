import { describe, it, expect } from "vitest";
import { computeInsertionLines } from "../insertion-lines.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";

function layout(
  positions: Array<{ id: string; x: number; y: number; width: number; height: number; colSpan: number }>,
): ComputedLayout {
  const map = new Map(positions.map((p) => [p.id, { ...p }]));
  return { positions: map, totalHeight: Math.max(0, ...positions.map((p) => p.y + p.height)) };
}

const BASE = {
  maxColumns: 2,
  containerWidth: 800,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
} as const;

describe("computeInsertionLines — source alone in its row", () => {
  // A          (row 0)
  // B = source (row 1, alone, free column to the right)
  // C C        (row 2, full width)
  //
  // The H-line directly under A (the gap above the source's row) must insert
  // the source right after A — not at the end of the list.
  const ws: WidgetState[] = [
    { id: "a", type: "x", colSpan: 1, visible: true, order: 0 },
    { id: "b", type: "x", colSpan: 1, visible: true, order: 1 },
    { id: "c", type: "x", colSpan: 2, visible: true, order: 2 },
  ];
  const lay = layout([
    { id: "a", x: 0, y: 0, width: 392, height: 100, colSpan: 1 },
    { id: "b", x: 0, y: 116, width: 392, height: 100, colSpan: 1 },
    { id: "c", x: 0, y: 232, width: 800, height: 100, colSpan: 2 },
  ]);

  it("H-line under A inserts right after A, not at end of list", () => {
    const lines = computeInsertionLines({ ...BASE, layout: lay, widgets: ws, sourceId: "b", dropMode: "lines" });
    const underA = lines.find(
      (l) => l.orientation === "horizontal" && l.beforeId === "a" && l.afterId === null,
    );
    expect(underA).toBeDefined();
    expect(underA!.insertionIndex).toBe(1);
    expect(underA!.disabled).toBe(false);
  });

  it("H-line below the source's row agrees with the line above it", () => {
    const lines = computeInsertionLines({ ...BASE, layout: lay, widgets: ws, sourceId: "b", dropMode: "lines" });
    const underA = lines.find(
      (l) => l.orientation === "horizontal" && l.beforeId === "a" && l.afterId === null,
    );
    const aboveC = lines.find(
      (l) => l.orientation === "horizontal" && l.beforeId === null && l.afterId === "c",
    );
    expect(underA!.insertionIndex).toBe(aboveC!.insertionIndex);
  });

  it("H-line below the last row still inserts at end of list", () => {
    const lines = computeInsertionLines({ ...BASE, layout: lay, widgets: ws, sourceId: "b", dropMode: "lines" });
    const belowC = lines.find(
      (l) => l.orientation === "horizontal" && l.beforeId === "c" && l.afterId === null,
    );
    expect(belowC).toBeDefined();
    expect(belowC!.insertionIndex).toBe(2);
  });
});
