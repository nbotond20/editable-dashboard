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

describe("resolveIntent — autoResize disabled", () => {
  it("classic widget hover stays swap even past resize dwell", () => {
    const zone: DropZone = { type: "widget", targetId: "a", side: "left" };
    const source = widget("src", 1, 5);
    const widgets = [widget("a", 1, 0)];
    const past = resolveIntent(zone, 5000, source, widgets, { ...CFG, dropMode: "classic", autoResize: false });
    expect(past).toEqual({ type: "swap", targetId: "a" });
  });

  it("classic widget hover auto-resizes when autoResize enabled (control)", () => {
    const zone: DropZone = { type: "widget", targetId: "a", side: "right" };
    const source = widget("src", 2, 5);
    const widgets = [widget("a", 2, 0)];
    const past = resolveIntent(zone, 5000, source, widgets, { ...CFG, dropMode: "classic", autoResize: true });
    expect(past.type).toBe("auto-resize");
  });

  it("insertion-line-v returns none when it would require resizing the row", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 512, h: 100 },
      { id: "b", x: 528, y: 0, w: 256, h: 100 },
    ]);
    const zone: DropZone = { type: "insertion-line-v", lineId: "v", insertionIndex: 1, beforeId: "a", afterId: "b" };
    const source = widget("src", 2, 5);
    const widgets = [widget("a", 2, 0), widget("b", 1, 1)];
    const result = resolveIntent(zone, 0, source, widgets, { ...CFG, layout: lay, autoResize: false });
    expect(result).toEqual({ type: "none" });
  });

  it("insertion-line-v still inserts when the row fits without resizing", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, w: 256, h: 100 }]);
    const zone: DropZone = { type: "insertion-line-v", lineId: "v", insertionIndex: 1, beforeId: "a", afterId: null };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a", 1, 0)], { ...CFG, layout: lay, autoResize: false });
    expect(result).toEqual({ type: "in-row-insert", insertionIndex: 1, resize: [] });
  });

  it("new-row keeps the source colSpan instead of growing to fill", () => {
    const zone: DropZone = { type: "insertion-line-h", lineId: "h", insertionIndex: 1, beforeId: "a", afterId: "b" };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a"), widget("b")], { ...CFG, autoResize: false });
    expect(result).toEqual({ type: "new-row", insertionIndex: 1, colSpan: 1 });
  });

  it("new-row grows the source to fill when autoResize enabled (control)", () => {
    const zone: DropZone = { type: "insertion-line-h", lineId: "h", insertionIndex: 1, beforeId: "a", afterId: "b" };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a"), widget("b")], { ...CFG, autoResize: true });
    expect(result).toEqual({ type: "new-row", insertionIndex: 1, colSpan: 3 });
  });

  it("empty zone does not maximize a shrunk source when autoResize disabled", () => {
    const lay = layout([{ id: "src", x: 0, y: 0, w: 256, h: 100 }]);
    const zone: DropZone = { type: "empty", column: 0 };
    const source = widget("src", 1, 0);
    const result = resolveIntent(zone, 5000, source, [source], {
      ...CFG,
      layout: lay,
      pointerY: 400,
      autoResize: false,
    });
    expect(result.type).not.toBe("empty-row-maximize");
  });
});
