import { describe, it, expect } from "vitest";
import { resolveZone } from "../zone-resolver.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";
import type { Point } from "../types.ts";

// ─── Test Helpers ──────────────────────────────────────────────────

interface WidgetSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colSpan: number;
}

/** Build a ComputedLayout from an array of widget specs. */
function makeLayout(specs: WidgetSpec[], totalHeight?: number): ComputedLayout {
  const positions = new Map(
    specs.map((s) => [
      s.id,
      {
        id: s.id,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        colSpan: s.colSpan,
      },
    ])
  );

  const computedHeight =
    totalHeight ??
    (specs.length > 0
      ? Math.max(...specs.map((s) => s.y + s.height))
      : 0);

  return { positions, totalHeight: computedHeight };
}

/** Build a WidgetState list matching the layout specs. */
function makeWidgets(
  ids: string[],
  options?: Partial<Record<string, { visible?: boolean; order?: number }>>
): WidgetState[] {
  return ids.map((id, i) => ({
    id,
    type: "generic",
    colSpan: 1,
    visible: options?.[id]?.visible ?? true,
    order: options?.[id]?.order ?? i,
  }));
}

/** Convenience: standard 4-column, 800px layout with 16px gap. */
const STD = {
  gap: 16,
  maxColumns: 4,
  containerWidth: 800,
  /** column width = (800 - 16*3) / 4 = 188 */
  colWidth: (800 - 16 * 3) / 4,
} as const;

/** Build a point. */
function pt(x: number, y: number): Point {
  return { x, y };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("resolveZone", () => {
  describe("pointer inside a widget body", () => {
    it("returns widget zone when pointer is in the inset rect center", () => {
      // One widget at (0, 0), 188x100, colSpan 1
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      // Center of inset rect: inset = 8, so body starts at (8,8), size 172x84
      // Center = (8 + 86, 8 + 42) = (94, 50)
      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "widget", targetId: "w1" });
    });

    it("returns widget zone for each widget when multiple are present", () => {
      // Two widgets side by side on the same row
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      const zone1 = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone1).toEqual({ type: "widget", targetId: "w1" });

      const zone2 = resolveZone(pt(298, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone2).toEqual({ type: "widget", targetId: "w2" });
    });
  });

  describe("pointer in horizontal gap between widgets on same row", () => {
    it("returns gap zone with correct index", () => {
      // Two widgets side by side: w1 at x=0..188, w2 at x=204..392
      // Horizontal gap: x=188..204
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // Pointer in the gap between them (x=196, y=50)
      const zone = resolveZone(pt(196, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });

    it("returns correct index for gap between second and third widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w3", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2", "w3"]);

      // Gap between w2 (ends at 392) and w3 (starts at 408): pointer at x=400
      const zone = resolveZone(pt(400, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w2",
        afterId: "w3",
        index: 2,
      });
    });
  });

  describe("pointer in vertical gap between rows", () => {
    it("returns gap zone between two rows", () => {
      // w1 on row 1 (y=0..100), w2 on row 2 (y=116..216) with 16px gap
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 800, height: 100, colSpan: 4 },
        { id: "w2", x: 0, y: 116, width: 800, height: 100, colSpan: 4 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // Pointer in vertical gap (y=108, between 100 and 116)
      const zone = resolveZone(pt(400, 108), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });
  });

  describe("pointer below all widgets", () => {
    it("returns empty zone with correct column", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      // Pointer below totalHeight (100), at x position in column 2
      // colWidth = 188, gap = 16, so col 2 starts at 204+188 = 408
      // Actually column 0: x=0..188, column 1: x=204..392, column 2: x=408..596
      // At x=410, column = floor(410 / (188+16)) = floor(410/204) = 2
      const zone = resolveZone(pt(410, 150), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "empty", column: 2 });
    });

    it("returns column 0 for pointer at left edge", () => {
      const layout = makeLayout([], 0);
      const widgets: WidgetState[] = [];

      const zone = resolveZone(pt(10, 10), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "empty", column: 0 });
    });

    it("returns last column for pointer at right edge", () => {
      const layout = makeLayout([], 0);
      const widgets: WidgetState[] = [];

      // x = 799, should be column 3 (last column)
      const zone = resolveZone(pt(799, 10), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "empty", column: 3 });
    });
  });

  describe("pointer outside container bounds", () => {
    it("returns outside zone for negative x", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      const zone = resolveZone(pt(-10, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "outside" });
    });

    it("returns outside zone for x beyond container width", () => {
      const layout = makeLayout([], 0);
      const widgets: WidgetState[] = [];

      const zone = resolveZone(pt(850, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "outside" });
    });

    it("returns outside zone for negative y with no widgets", () => {
      const layout = makeLayout([], 0);
      const widgets: WidgetState[] = [];

      const zone = resolveZone(pt(100, -10), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "outside" });
    });
  });

  describe("source widget exclusion", () => {
    it("does not return widget zone for the source widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // Pointer over w1's center, but w1 is the source
      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "w1");

      // Should NOT be { type: "widget", targetId: "w1" }
      expect(zone.type).not.toBe("widget");
    });

    it("returns gap zone when pointer is over source widget area", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // Pointer at w1's position, w1 is source → w1 excluded, the pointer
      // is in the gap area before w2 (which is now the first resolved widget)
      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "w1");

      expect(zone).toEqual({
        type: "gap",
        beforeId: null,
        afterId: "w2",
        index: 0,
      });
    });

    it("still returns widget zone for non-source widgets", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // Pointer over w2's center, w1 is source
      const zone = resolveZone(pt(298, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "w1");

      expect(zone).toEqual({ type: "widget", targetId: "w2" });
    });
  });

  describe("single column layout", () => {
    it("detects widget zone in single column", () => {
      // Single column: containerWidth = 200, maxColumns = 1, gap = 16
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 200, height: 100, colSpan: 1 },
        { id: "w2", x: 0, y: 116, width: 200, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      const zone = resolveZone(pt(100, 50), layout, widgets, 16, 1, 200, "none");

      expect(zone).toEqual({ type: "widget", targetId: "w1" });
    });

    it("detects vertical gap in single column", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 200, height: 100, colSpan: 1 },
        { id: "w2", x: 0, y: 116, width: 200, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // Vertical gap between rows: y = 108 (between 100 and 116)
      const zone = resolveZone(pt(100, 108), layout, widgets, 16, 1, 200, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });

    it("has no horizontal gaps in single column layout", () => {
      // Widget fills entire width → no horizontal gap to find
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 200, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      // Right edge is at container boundary, no horizontal gap
      // Pointer at x=200 is outside containerWidth
      const zone = resolveZone(pt(200, 50), layout, widgets, 16, 1, 200, "none");

      expect(zone).toEqual({ type: "outside" });
    });
  });

  describe("single widget", () => {
    it("returns widget zone when inside the widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "widget", targetId: "w1" });
    });

    it("returns gap after the widget when pointer is to its right", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      // Pointer to the right of w1 on the same row
      const zone = resolveZone(pt(300, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: null,
        index: 1,
      });
    });
  });

  describe("empty dashboard", () => {
    it("returns empty zone when there are no widgets and pointer is inside container", () => {
      const layout = makeLayout([], 0);
      const widgets: WidgetState[] = [];

      const zone = resolveZone(pt(100, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      // totalHeight is 0, so pointer.y (50) >= totalHeight (0) and x in range → empty
      expect(zone).toEqual({ type: "empty", column: 0 });
    });

    it("returns outside zone when pointer is outside container on empty dashboard", () => {
      const layout = makeLayout([], 0);
      const widgets: WidgetState[] = [];

      const zone = resolveZone(pt(900, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "outside" });
    });
  });

  describe("boundary conditions", () => {
    it("pointer on exact left edge of widget inset returns widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      // inset = 8, so inset rect starts at x=8, y=8
      const zone = resolveZone(pt(8, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "widget", targetId: "w1" });
    });

    it("pointer just outside widget inset falls into gap region", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // w1 inset right edge = 0 + 8 + (188 - 16) = 180
      // Pointer at x=180 is at the inset boundary (exclusive end)
      // The area between x=180 and x=204 should be gap territory
      const zone = resolveZone(pt(185, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });

    it("pointer exactly at widget right boundary (end of inset) resolves to gap", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // w1 inset: x=8..180 (width 172). At x=180 it is no longer inside (exclusive).
      // This should be in the gap.
      const zone = resolveZone(pt(180, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });
  });

  describe("multi-row wrapping layout", () => {
    it("correctly identifies gap when widget wraps to next row", () => {
      // 4 columns, 3 widgets on row 1, 1 widget wraps to row 2
      // colWidth = 188, gap = 16
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w3", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w4", x: 0, y: 116, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2", "w3", "w4"]);

      // Gap between w3 (row 1, col 2) and w4 (row 2, col 0):
      // pointer at x=700 (right of w3 on row 1, in gap area)
      const zone = resolveZone(pt(700, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w3",
        afterId: "w4",
        index: 3,
      });
    });
  });

  describe("widgets with varying colSpan", () => {
    it("handles a wide widget next to a narrow widget", () => {
      // w1: 2-col (width = 2*188 + 16 = 392), w2: 1-col
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 392, height: 100, colSpan: 2 },
        { id: "w2", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      // Inside w1 center
      const zone1 = resolveZone(pt(196, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone1).toEqual({ type: "widget", targetId: "w1" });

      // In gap between w1 and w2
      const zone2 = resolveZone(pt(400, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone2).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });
  });

  describe("hidden widgets are excluded", () => {
    it("does not resolve to a hidden widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      // w1 is hidden
      const widgets = makeWidgets(["w1"], { w1: { visible: false } });

      // Pointer over where w1 would be
      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      // w1 is hidden so it's not in the resolved list; pointer falls through
      // to the "below all widgets" check or outside
      expect(zone.type).not.toBe("widget");
    });
  });

  describe("gap before first widget", () => {
    it("returns gap index 0 when pointer is to the left of first widget", () => {
      // First widget doesn't start at x=0
      const specs: WidgetSpec[] = [
        { id: "w1", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      const zone = resolveZone(pt(100, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: null,
        afterId: "w1",
        index: 0,
      });
    });

    it("returns gap index 0 when pointer is above the first widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 50, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      // Pointer above the widget (y=25) within its x range
      const zone = resolveZone(pt(94, 25), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: null,
        afterId: "w1",
        index: 0,
      });
    });
  });
});
