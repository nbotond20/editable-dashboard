import { describe, it, expect } from "vitest";
import {
  resolveIntent,
  computeDwellProgress,
  type IntentResolverConfig,
} from "../intent-resolver.ts";
import type { DropZone } from "../types.ts";
import type { WidgetState } from "../../types.ts";

function makeWidget(
  id: string,
  overrides: Partial<WidgetState> = {},
): WidgetState {
  return {
    id,
    type: "chart",
    colSpan: 1,
    visible: true,
    order: 0,
    ...overrides,
  };
}

function makeWidgets(
  ...specs: Array<[string, Partial<WidgetState>?]>
): WidgetState[] {
  return specs.map(([id, overrides], i) =>
    makeWidget(id, { order: i, ...overrides }),
  );
}

function defaultConfig(
  overrides: Partial<IntentResolverConfig> = {},
): IntentResolverConfig {
  return {
    swapDwellMs: 300,
    resizeDwellMs: 800,
    emptyRowMaximizeDwellMs: 600,
    maxColumns: 2,
    isPositionLocked: () => false,
    isResizeLocked: () => false,
    canDrop: () => true,
    getWidgetConstraints: () => ({ minSpan: 1, maxSpan: 2 }),
    ...overrides,
  };
}

describe("resolveIntent - gap zone", () => {
  const gapZone: DropZone = {
    type: "gap",
    beforeId: "a",
    afterId: "b",
    index: 1,
  };
  const source = makeWidget("src");
  const widgets = makeWidgets(["a"], ["b"]);

  it("returns reorder immediately regardless of dwell", () => {
    expect(resolveIntent(gapZone, 0, source, widgets, defaultConfig())).toEqual(
      { type: "reorder", targetIndex: 1 },
    );
  });

  it("returns reorder at any positive dwell time", () => {
    expect(
      resolveIntent(gapZone, 5000, source, widgets, defaultConfig()),
    ).toEqual({ type: "reorder", targetIndex: 1 });
  });

  it("respects canDrop constraint", () => {
    const config = defaultConfig({
      canDrop: (sourceId, targetIndex) =>
        !(sourceId === "src" && targetIndex === 1),
    });
    expect(resolveIntent(gapZone, 0, source, widgets, config)).toEqual({
      type: "none",
    });
  });

  it("allows drop when canDrop returns true for different index", () => {
    const zone: DropZone = {
      type: "gap",
      beforeId: null,
      afterId: "a",
      index: 0,
    };
    const config = defaultConfig({
      canDrop: (_sourceId, targetIndex) => targetIndex === 0,
    });
    expect(resolveIntent(zone, 0, source, widgets, config)).toEqual({
      type: "reorder",
      targetIndex: 0,
    });
  });
});

describe("resolveIntent - widget zone", () => {
  const widgetZone: DropZone = { type: "widget", targetId: "target", side: "left" };
  const source = makeWidget("src", { colSpan: 1 });
  const widgets = makeWidgets(["src"], ["target", { colSpan: 1 }]);

  it("returns none when dwell is 0", () => {
    expect(
      resolveIntent(widgetZone, 0, source, widgets, defaultConfig()),
    ).toEqual({ type: "none" });
  });

  it("returns none when dwell is below swap threshold", () => {
    expect(
      resolveIntent(widgetZone, 200, source, widgets, defaultConfig()),
    ).toEqual({ type: "none" });
  });

  it("returns swap when dwell exceeds swap threshold (400ms > 300)", () => {
    expect(
      resolveIntent(widgetZone, 400, source, widgets, defaultConfig()),
    ).toEqual({ type: "swap", targetId: "target" });
  });

  it("returns swap at exactly the swap threshold", () => {
    expect(
      resolveIntent(widgetZone, 300, source, widgets, defaultConfig()),
    ).toEqual({ type: "swap", targetId: "target" });
  });

  it("falls back to swap when auto-resize is a no-op (both fit, no reorder)", () => {
    const result = resolveIntent(
      widgetZone,
      1000,
      source,
      widgets,
      defaultConfig(),
    );
    expect(result).toEqual({
      type: "swap",
      targetId: "target",
    });
  });

  it("falls back to swap when maxColumns is 1", () => {
    const config = defaultConfig({ maxColumns: 1 });
    expect(resolveIntent(widgetZone, 1000, source, widgets, config)).toEqual({
      type: "swap",
      targetId: "target",
    });
  });

  it("returns none when target is locked regardless of dwell", () => {
    const config = defaultConfig({
      isPositionLocked: (id) => id === "target",
    });

    expect(resolveIntent(widgetZone, 0, source, widgets, config)).toEqual({
      type: "none",
    });
    expect(resolveIntent(widgetZone, 400, source, widgets, config)).toEqual({
      type: "none",
    });
    expect(resolveIntent(widgetZone, 1000, source, widgets, config)).toEqual({
      type: "none",
    });
  });

  it("returns swap for locked target even below swap threshold (still none)", () => {
    const config = defaultConfig({
      isPositionLocked: (id) => id === "target",
    });
    expect(resolveIntent(widgetZone, 150, source, widgets, config)).toEqual({
      type: "none",
    });
  });
});

describe("resolveIntent - auto-resize span computation", () => {
  it("falls back to swap when both fit and reorder is a no-op (3-col)", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 1 });
    const widgets = makeWidgets(["src", { colSpan: 1 }], ["target", { colSpan: 1 }]);
    const config = defaultConfig({ maxColumns: 3 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "swap",
      targetId: "target",
    });
  });

  it("falls back to swap when colSpans equal maxColumns and reorder is a no-op", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 2 });
    const widgets = makeWidgets(
      ["src", { colSpan: 2 }],
      ["target", { colSpan: 2 }],
    );
    const config = defaultConfig({ maxColumns: 4 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "swap",
      targetId: "target",
    });
  });

  it("returns auto-resize when both do not fit and resize is possible", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 2 });
    const widgets = makeWidgets(
      ["src", { colSpan: 2 }],
      ["target", { colSpan: 2 }],
    );
    const config = defaultConfig({ maxColumns: 2 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 1,
      targetSpan: 1,
      targetIndex: 0,
    });
  });

  it("falls back to swap when resized spans still exceed maxColumns (odd columns)", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 3 });
    const widgets = makeWidgets(
      ["src", { colSpan: 3 }],
      ["target", { colSpan: 3 }],
    );
    const config = defaultConfig({ maxColumns: 3 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 2,
      targetSpan: 1,
      targetIndex: 0,
    });
  });

  it("falls back to swap when minSpan constraint prevents fitting", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 3 });
    const widgets = makeWidgets(
      ["src", { colSpan: 3 }],
      ["target", { colSpan: 3 }],
    );
    const config = defaultConfig({
      maxColumns: 4,
      getWidgetConstraints: (id) => {
        if (id === "src") return { minSpan: 3, maxSpan: 4 };
        return { minSpan: 1, maxSpan: 4 };
      },
    });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 3,
      targetSpan: 1,
      targetIndex: 0,
    });
  });

  it("respects maxSpan constraint during auto-resize", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 4 });
    const widgets = makeWidgets(
      ["src", { colSpan: 4 }],
      ["target", { colSpan: 4 }],
    );
    const config = defaultConfig({
      maxColumns: 6,
      getWidgetConstraints: (id) => {
        if (id === "target") return { minSpan: 1, maxSpan: 2 };
        return { minSpan: 1, maxSpan: 6 };
      },
    });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 4,
      targetSpan: 2,
      targetIndex: 0,
    });
  });
});

describe("resolveIntent - direction-aware auto-resize", () => {
  it("places source before target when side is left", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 2 });
    const widgets = makeWidgets(
      ["src", { colSpan: 2 }],
      ["target", { colSpan: 2 }],
    );
    const config = defaultConfig({ maxColumns: 2 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 1,
      targetSpan: 1,
      targetIndex: 0,
    });
  });

  it("places source after target when side is right", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "right" };
    const source = makeWidget("src", { colSpan: 2 });
    const widgets = makeWidgets(
      ["src", { colSpan: 2 }],
      ["target", { colSpan: 2 }],
    );
    const config = defaultConfig({ maxColumns: 2 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 1,
      targetSpan: 1,
      targetIndex: 1,
    });
  });

  it("handles source after target with side left", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "left" };
    const source = makeWidget("src", { colSpan: 2, order: 2 });
    const widgets = makeWidgets(
      ["target", { colSpan: 2 }],
      ["other"],
      ["src", { colSpan: 2 }],
    );
    const config = defaultConfig({ maxColumns: 2 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 1,
      targetSpan: 1,
      targetIndex: 0,
    });
  });

  it("handles source after target with side right", () => {
    const zone: DropZone = { type: "widget", targetId: "target", side: "right" };
    const source = makeWidget("src", { colSpan: 2, order: 2 });
    const widgets = makeWidgets(
      ["target", { colSpan: 2 }],
      ["other"],
      ["src", { colSpan: 2 }],
    );
    const config = defaultConfig({ maxColumns: 2 });

    const result = resolveIntent(zone, 1000, source, widgets, config);
    expect(result).toEqual({
      type: "auto-resize",
      targetId: "target",
      sourceSpan: 1,
      targetSpan: 1,
      targetIndex: 1,
    });
  });
});

describe("resolveIntent - empty zone", () => {
  const source = makeWidget("src");
  const widgets = makeWidgets(["a"]);

  it("returns column-pin immediately", () => {
    const zone: DropZone = { type: "empty", column: 0 };
    expect(resolveIntent(zone, 0, source, widgets, defaultConfig())).toEqual({
      type: "column-pin",
      column: 0,
    });
  });

  it("returns column-pin regardless of dwell time", () => {
    const zone: DropZone = { type: "empty", column: 1 };
    expect(
      resolveIntent(zone, 5000, source, widgets, defaultConfig()),
    ).toEqual({ type: "column-pin", column: 1 });
  });
});

describe("resolveIntent - outside zone", () => {
  const source = makeWidget("src");
  const widgets = makeWidgets(["a"]);
  const zone: DropZone = { type: "outside" };

  it("returns none", () => {
    expect(resolveIntent(zone, 0, source, widgets, defaultConfig())).toEqual({
      type: "none",
    });
  });

  it("returns none regardless of dwell time", () => {
    expect(
      resolveIntent(zone, 5000, source, widgets, defaultConfig()),
    ).toEqual({ type: "none" });
  });
});

describe("resolveIntent - custom threshold overrides", () => {
  const widgetZone: DropZone = { type: "widget", targetId: "target", side: "left" };
  const source = makeWidget("src", { colSpan: 1 });
  const widgets = makeWidgets(["src"], ["target", { colSpan: 1 }]);

  it("uses custom swapDwellMs", () => {
    const config = defaultConfig({ swapDwellMs: 500 });

    expect(resolveIntent(widgetZone, 400, source, widgets, config)).toEqual({
      type: "none",
    });

    expect(resolveIntent(widgetZone, 500, source, widgets, config)).toEqual({
      type: "swap",
      targetId: "target",
    });
  });

  it("uses custom resizeDwellMs with widgets that need resize", () => {
    const bigSource = makeWidget("src", { colSpan: 2 });
    const bigWidgets = makeWidgets(
      ["src", { colSpan: 2 }],
      ["target", { colSpan: 2 }],
    );
    const config = defaultConfig({ resizeDwellMs: 1500 });

    expect(resolveIntent(widgetZone, 1000, bigSource, bigWidgets, config)).toEqual({
      type: "swap",
      targetId: "target",
    });

    const result = resolveIntent(widgetZone, 1500, bigSource, bigWidgets, config);
    expect(result.type).toBe("auto-resize");
  });
});

describe("computeDwellProgress", () => {
  const swapDwell = 300;
  const resizeDwell = 800;

  describe("widget zone", () => {
    const zone: DropZone = { type: "widget", targetId: "t", side: "left" };

    it("returns 0 at dwell=0", () => {
      expect(computeDwellProgress(zone, 0, swapDwell, resizeDwell)).toBe(0);
    });

    it("returns 0.5 at halfway to swap threshold", () => {
      expect(computeDwellProgress(zone, 150, swapDwell, resizeDwell)).toBe(0.5);
    });

    it("returns progress toward swap threshold", () => {
      const progress = computeDwellProgress(zone, 100, swapDwell, resizeDwell);
      expect(progress).toBeCloseTo(100 / 300);
    });

    it("resets to 0 at exactly the swap threshold (start of resize progress)", () => {
      expect(computeDwellProgress(zone, 300, swapDwell, resizeDwell)).toBe(0);
    });

    it("returns progress toward resize after swap threshold", () => {
      expect(computeDwellProgress(zone, 550, swapDwell, resizeDwell)).toBe(0.5);
    });

    it("returns 1 at exactly the resize threshold", () => {
      expect(computeDwellProgress(zone, 800, swapDwell, resizeDwell)).toBe(1);
    });

    it("returns 1 past the resize threshold", () => {
      expect(computeDwellProgress(zone, 2000, swapDwell, resizeDwell)).toBe(1);
    });
  });

  describe("gap zone", () => {
    const zone: DropZone = {
      type: "gap",
      beforeId: "a",
      afterId: "b",
      index: 1,
    };

    it("returns 1 regardless of dwell", () => {
      expect(computeDwellProgress(zone, 0, swapDwell, resizeDwell)).toBe(1);
      expect(computeDwellProgress(zone, 500, swapDwell, resizeDwell)).toBe(1);
    });
  });

  describe("empty zone", () => {
    const zone: DropZone = { type: "empty", column: 0 };

    it("returns 1 regardless of dwell", () => {
      expect(computeDwellProgress(zone, 0, swapDwell, resizeDwell)).toBe(1);
      expect(computeDwellProgress(zone, 500, swapDwell, resizeDwell)).toBe(1);
    });
  });

  describe("outside zone", () => {
    const zone: DropZone = { type: "outside" };

    it("returns 0 regardless of dwell", () => {
      expect(computeDwellProgress(zone, 0, swapDwell, resizeDwell)).toBe(0);
      expect(computeDwellProgress(zone, 500, swapDwell, resizeDwell)).toBe(0);
    });
  });

  describe("edge cases", () => {
    const zone: DropZone = { type: "widget", targetId: "t", side: "left" };

    it("handles swapDwellMs of 0", () => {
      expect(computeDwellProgress(zone, 0, 0, 800)).toBe(0);
      expect(computeDwellProgress(zone, 400, 0, 800)).toBe(0.5);
    });

    it("handles equal swap and resize thresholds", () => {
      expect(computeDwellProgress(zone, 300, 300, 300)).toBe(1);
    });
  });
});
