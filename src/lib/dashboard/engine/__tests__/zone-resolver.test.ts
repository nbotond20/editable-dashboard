import { describe, it, expect } from "vitest";
import { resolveZone } from "../zone-resolver.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";
import type { Point } from "../types.ts";

interface WidgetSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colSpan: number;
}

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

const STD = {
  gap: 16,
  maxColumns: 4,
  containerWidth: 800,
  
  colWidth: (800 - 16 * 3) / 4,
} as const;

function pt(x: number, y: number): Point {
  return { x, y };
}

describe("resolveZone", () => {
  describe("pointer inside a widget body", () => {
    it("returns widget zone when pointer is in the inset rect center", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "widget", targetId: "w1", side: "right" });
    });

    it("returns widget zone for each widget when multiple are present", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      const zone1 = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone1).toEqual({ type: "widget", targetId: "w1", side: "right" });

      const zone2 = resolveZone(pt(298, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone2).toEqual({ type: "widget", targetId: "w2", side: "right" });
    });
  });

  describe("pointer in horizontal gap between widgets on same row", () => {
    it("returns gap zone with correct index", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

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
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 800, height: 100, colSpan: 4 },
        { id: "w2", x: 0, y: 116, width: 800, height: 100, colSpan: 4 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

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

      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "w1");

      expect(zone.type).not.toBe("widget");
    });

    it("returns gap zone when pointer is over source widget area", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

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

      const zone = resolveZone(pt(298, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "w1");

      expect(zone).toEqual({ type: "widget", targetId: "w2", side: "right" });
    });
  });

  describe("single column layout", () => {
    it("detects widget zone in single column", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 200, height: 100, colSpan: 1 },
        { id: "w2", x: 0, y: 116, width: 200, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      const zone = resolveZone(pt(100, 50), layout, widgets, 16, 1, 200, "none");

      expect(zone).toEqual({ type: "widget", targetId: "w1", side: "right" });
    });

    it("detects vertical gap in single column", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 200, height: 100, colSpan: 1 },
        { id: "w2", x: 0, y: 116, width: 200, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      const zone = resolveZone(pt(100, 108), layout, widgets, 16, 1, 200, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });

    it("has no horizontal gaps in single column layout", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 200, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

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

      expect(zone).toEqual({ type: "widget", targetId: "w1", side: "right" });
    });

    it("returns gap after the widget when pointer is to its right", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"]);

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

      const zone = resolveZone(pt(8, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({ type: "widget", targetId: "w1", side: "left" });
    });

    it("pointer just outside widget inset falls into gap region", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

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
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w3", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w4", x: 0, y: 116, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2", "w3", "w4"]);

      const zone = resolveZone(pt(700, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone).toEqual({
        type: "gap",
        beforeId: "w3",
        afterId: "w4",
        index: 3,
      });
    });

    it("does not claim unrelated columns as row-break gap", () => {
      const cw = 600;
      const colW = (cw - 16 * 2) / 3;
      const specs: WidgetSpec[] = [
        { id: "A", x: 0, y: 0, width: colW * 2 + 16, height: 200, colSpan: 2 },
        { id: "B", x: 2 * (colW + 16), y: 0, width: colW, height: 200, colSpan: 1 },
        { id: "C", x: 0, y: 216, width: colW, height: 200, colSpan: 1 },
        { id: "phantom_D", x: 2 * (colW + 16), y: 216, width: colW, height: 200, colSpan: 1 },
      ];
      const layout = makeLayout(specs, 416);
      const widgets = makeWidgets(["A", "B", "C"]);

      const zone = resolveZone(
        pt(colW + 16 + colW / 2, 208),
        layout,
        widgets,
        16,
        3,
        cw,
        "D"
      );

      expect(zone).toEqual({ type: "empty", column: 1 });
    });
  });

  describe("widgets with varying colSpan", () => {
    it("handles a wide widget next to a narrow widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 392, height: 100, colSpan: 2 },
        { id: "w2", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1", "w2"]);

      const zone1 = resolveZone(pt(196, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone1).toEqual({ type: "widget", targetId: "w1", side: "right" });

      const zone2 = resolveZone(pt(400, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");
      expect(zone2).toEqual({
        type: "gap",
        beforeId: "w1",
        afterId: "w2",
        index: 1,
      });
    });
  });

  describe("open column space within the grid", () => {
    it("returns empty zone when pointer is in a shorter column's open space", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w3", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "phantom", x: 204, y: 116, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs, 216);
      const widgets = makeWidgets(["w1", "w2", "w3"]);

      const zone = resolveZone(
        pt(94, 150),
        layout,
        widgets,
        STD.gap,
        3,
        3 * 188 + 2 * 16,
        "source"
      );

      expect(zone).toEqual({ type: "empty", column: 0 });
    });

    it("returns empty zone for the right column's open space", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w3", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "phantom", x: 204, y: 116, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs, 216);
      const widgets = makeWidgets(["w1", "w2", "w3"]);

      const zone = resolveZone(
        pt(500, 150),
        layout,
        widgets,
        STD.gap,
        3,
        3 * 188 + 2 * 16,
        "source"
      );

      expect(zone).toEqual({ type: "empty", column: 2 });
    });

    it("does not return empty zone for column with content at that height", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w2", x: 204, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "w3", x: 408, y: 0, width: 188, height: 100, colSpan: 1 },
        { id: "phantom", x: 204, y: 116, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs, 216);
      const widgets = makeWidgets(["w1", "w2", "w3"]);

      const zone = resolveZone(
        pt(298, 150),
        layout,
        widgets,
        STD.gap,
        3,
        3 * 188 + 2 * 16,
        "source"
      );

      expect(zone.type).not.toBe("empty");
    });
  });

  describe("hidden widgets are excluded", () => {
    it("does not resolve to a hidden widget", () => {
      const specs: WidgetSpec[] = [
        { id: "w1", x: 0, y: 0, width: 188, height: 100, colSpan: 1 },
      ];
      const layout = makeLayout(specs);
      const widgets = makeWidgets(["w1"], { w1: { visible: false } });

      const zone = resolveZone(pt(94, 50), layout, widgets, STD.gap, STD.maxColumns, STD.containerWidth, "none");

      expect(zone.type).not.toBe("widget");
    });
  });

  describe("gap before first widget", () => {
    it("returns gap index 0 when pointer is to the left of first widget", () => {
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
