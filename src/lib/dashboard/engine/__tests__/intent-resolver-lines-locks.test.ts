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

describe("resolveIntent — insertion-line lock/constraint behavior", () => {
  it("returns none for insertion-line-h when displacement would cross a position-locked widget", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 3,
      beforeId: "c", afterId: null,
    };
    const widgets = [widget("src", 1, 0), widget("locked", 1, 1), widget("c", 1, 2)];
    const result = resolveIntent(zone, 0, widgets[0], widgets, {
      ...CFG,
      isPositionLocked: (id) => id === "locked",
    });
    expect(result).toEqual({ type: "none" });
  });

  it("returns none for insertion-line-v when displacement would cross a position-locked widget", () => {
    const lay = layout([{ id: "c", x: 0, y: 0, w: 256, h: 100 }]);
    const zone: DropZone = {
      type: "insertion-line-v",
      lineId: "v",
      insertionIndex: 3,
      beforeId: "c", afterId: null,
    };
    const widgets = [widget("src", 1, 0), widget("locked", 1, 1), widget("c", 1, 2)];
    const result = resolveIntent(zone, 0, widgets[0], widgets, {
      ...CFG,
      layout: lay,
      isPositionLocked: (id) => id === "locked",
    });
    expect(result).toEqual({ type: "none" });
  });

  it("keeps current colSpan for new-row when source is resize-locked", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 0,
      beforeId: null, afterId: "a",
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a"), source], {
      ...CFG,
      isResizeLocked: (id) => id === "src",
    });
    expect(result).toEqual({ type: "new-row", insertionIndex: 0, colSpan: 1 });
  });

  it("returns none for new-row when resize-locked source's span exceeds maxColumns", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 0,
      beforeId: null, afterId: "a",
    };
    const source = { id: "src", type: "x", colSpan: 4, visible: true, order: 1 };
    const result = resolveIntent(zone, 0, source, [widget("a"), source], {
      ...CFG,
      isResizeLocked: (id) => id === "src",
    });
    expect(result).toEqual({ type: "none" });
  });

  it("returns none for new-row when constraints force span outside [1, maxColumns]", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 0,
      beforeId: null, afterId: "a",
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a"), source], {
      ...CFG,
      getWidgetConstraints: (id) => (id === "src" ? { minSpan: 5, maxSpan: 5 } : { minSpan: 1, maxSpan: 3 }),
    });
    expect(result).toEqual({ type: "none" });
  });

  it("returns none for in-row-insert when source is resize-locked and span would need to change", () => {
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
    const result = resolveIntent(zone, 0, source, [widget("a", 2, 0), widget("b", 1, 1), source], {
      ...CFG,
      layout: lay,
      isResizeLocked: (id) => id === "src",
    });
    expect(result).toEqual({ type: "none" });
  });
});
