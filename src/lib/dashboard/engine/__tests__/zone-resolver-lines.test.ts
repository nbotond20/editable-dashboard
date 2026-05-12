import { describe, it, expect } from "vitest";
import { resolveZone } from "../zone-resolver.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";
import type { InsertionLine } from "../types.ts";

function layout(specs: Array<{ id: string; x: number; y: number; width: number; height: number }>): ComputedLayout {
  return {
    positions: new Map(specs.map((s) => [s.id, { id: s.id, x: s.x, y: s.y, width: s.width, height: s.height, colSpan: 1 }])),
    totalHeight: Math.max(0, ...specs.map((s) => s.y + s.height)),
  };
}

function widgets(ids: string[]): WidgetState[] {
  return ids.map((id, i) => ({ id, type: "x", colSpan: 1, visible: true, order: i }));
}

const STD = { gap: 16, maxColumns: 3, containerWidth: 800 };

describe("resolveZone — mode-aware line snapping", () => {
  it("returns widget zone for pointer inside widget interior even when lines are provided", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [];
    const zone = resolveZone(
      { x: 128, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "lines", lines, 16, null
    );
    expect(zone.type).toBe("widget");
  });

  it("returns insertion-line-v when pointer snaps to a V-line in lines mode", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [
      {
        id: "v-a-end-0",
        orientation: "vertical",
        x1: 256, y1: 0, x2: 256, y2: 100,
        insertionIndex: 1,
        beforeId: "a",
        afterId: null,
        isActive: false,
        disabled: false,
      },
    ];
    const zone = resolveZone(
      { x: 260, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "lines", lines, 16, null
    );
    expect(zone).toEqual({
      type: "insertion-line-v",
      lineId: "v-a-end-0",
      insertionIndex: 1,
      beforeId: "a",
      afterId: null,
    });
  });

  it("collapses non-widget zones to outside in lines mode when no line snaps", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [];
    const zone = resolveZone(
      { x: 400, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "lines", lines, 16, null
    );
    expect(zone.type).toBe("outside");
  });

  it("ignores lines entirely in classic mode", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [
      {
        id: "v-a-end-0",
        orientation: "vertical",
        x1: 256, y1: 0, x2: 256, y2: 100,
        insertionIndex: 1,
        beforeId: "a", afterId: null,
        isActive: false, disabled: false,
      },
    ];
    const zone = resolveZone(
      { x: 260, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "classic", lines, 16, null
    );
    expect(zone.type).not.toBe("insertion-line-v");
  });
});
