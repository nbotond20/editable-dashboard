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

const CONFIG = {
  maxColumns: 3,
  containerWidth: 800,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
};

describe("computeInsertionLines — autoResize disabled", () => {
  const lay = layout([
    { id: "a", x: 0, y: 0, width: 528, height: 100, colSpan: 2 },
    { id: "b", x: 544, y: 0, width: 256, height: 100, colSpan: 1 },
  ]);
  const ws = [widget("a", 2, 0), widget("b", 1, 1), widget("src", 2, 2)];

  it("disables in-row V-lines that would need a resize, with column-overflow reason", () => {
    const result = computeInsertionLines({
      layout: lay,
      widgets: ws,
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
      autoResize: false,
    });
    const vLines = result.filter((l) => l.orientation === "vertical");
    expect(vLines.length).toBeGreaterThan(0);
    expect(vLines.every((l) => l.disabled)).toBe(true);
    expect(vLines.some((l) => l.disabledReason === "column-overflow")).toBe(true);
  });

  it("keeps those V-lines feasible when autoResize is enabled (control)", () => {
    const result = computeInsertionLines({
      layout: lay,
      widgets: ws,
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
      autoResize: true,
    });
    const vLines = result.filter((l) => l.orientation === "vertical");
    expect(vLines.some((l) => !l.disabled)).toBe(true);
  });
});
