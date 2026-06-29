import { describe, it, expect } from "vitest";
import { resolveIntent, swapNeedsResizeToFit } from "../intent-resolver.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";
import type { DropZone } from "../types.ts";

function widget(id: string, colSpan = 1, order = 0): WidgetState {
  return { id, type: "x", colSpan, visible: true, order };
}

function layout(specs: Array<{ id: string; x: number; y: number; w: number }>): ComputedLayout {
  return {
    positions: new Map(specs.map((s) => [s.id, { id: s.id, x: s.x, y: s.y, width: s.w, height: 100, colSpan: 1 }])),
    totalHeight: 200,
  };
}

// Layout "A B / C C" in 2 columns: a,b share row 0; c fills row 1.
const ROW = layout([
  { id: "a", x: 0, y: 0, w: 256 },
  { id: "b", x: 272, y: 0, w: 256 },
  { id: "c", x: 0, y: 116, w: 528 },
]);
const WIDGETS = [widget("a", 1, 0), widget("b", 1, 1), widget("c", 2, 2)];

const CFG = {
  swapDwellMs: 0,
  resizeDwellMs: 600,
  emptyRowMaximizeDwellMs: 600,
  maxColumns: 2,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
  canDrop: () => true,
  getWidgetConstraints: () => ({ minSpan: 1, maxSpan: 2 }),
  baseLayout: ROW,
  layout: ROW,
};

describe("swapNeedsResizeToFit", () => {
  it("is true when the source is wider than the target's row slot", () => {
    expect(swapNeedsResizeToFit(WIDGETS, "c", "b", 2, ROW)).toBe(true);
  });

  it("is true symmetrically when the target is too wide for the source's row", () => {
    expect(swapNeedsResizeToFit(WIDGETS, "b", "c", 2, ROW)).toBe(true);
  });

  it("is false when both widgets fit in each other's rows", () => {
    expect(swapNeedsResizeToFit(WIDGETS, "a", "b", 2, ROW)).toBe(false);
  });

  it("is false for equal-width widgets alone in their rows", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 528 },
      { id: "b", x: 0, y: 116, w: 528 },
    ]);
    expect(swapNeedsResizeToFit([widget("a", 2, 0), widget("b", 2, 1)], "a", "b", 2, lay)).toBe(false);
  });
});

describe("resolveIntent — swap blocked when autoResize disabled", () => {
  it("lines mode: dragging C over B is blocked (cannot fit)", () => {
    const zone: DropZone = { type: "widget", targetId: "b", side: "left" };
    const result = resolveIntent(zone, 0, widget("c", 2, 2), WIDGETS, {
      ...CFG,
      dropMode: "lines",
      autoResize: false,
    });
    expect(result).toEqual({ type: "none" });
  });

  it("classic mode: dragging C over B is blocked (cannot fit)", () => {
    const zone: DropZone = { type: "widget", targetId: "b", side: "left" };
    const result = resolveIntent(zone, 5000, widget("c", 2, 2), WIDGETS, {
      ...CFG,
      dropMode: "classic",
      autoResize: false,
    });
    expect(result).toEqual({ type: "none" });
  });

  it("lines mode: an equal-fit swap is still allowed", () => {
    const zone: DropZone = { type: "widget", targetId: "b", side: "left" };
    const result = resolveIntent(zone, 0, widget("a", 1, 0), WIDGETS, {
      ...CFG,
      dropMode: "lines",
      autoResize: false,
    });
    expect(result).toEqual({ type: "deferred-swap", targetId: "b" });
  });

  it("lines mode with autoResize enabled: the same drag still swaps (control)", () => {
    const zone: DropZone = { type: "widget", targetId: "b", side: "left" };
    const result = resolveIntent(zone, 0, widget("c", 2, 2), WIDGETS, {
      ...CFG,
      dropMode: "lines",
      autoResize: true,
    });
    expect(result).toEqual({ type: "deferred-swap", targetId: "b" });
  });
});
