import { describe, it, expect } from "vitest";
import { applyOperation } from "../operation-applier.ts";
import type { DashboardState, WidgetState } from "../../types.ts";

function createState(
  widgets: Array<{
    id: string;
    colSpan: number;
    order: number;
    visible?: boolean;
  }>
): DashboardState {
  return {
    widgets: widgets.map(
      (w): WidgetState => ({
        id: w.id,
        type: "test",
        colSpan: w.colSpan,
        visible: w.visible ?? true,
        order: w.order,
      })
    ),
    maxColumns: 4,
    gap: 16,
    containerWidth: 1000,
  };
}

function visibleSorted(state: DashboardState): WidgetState[] {
  return state.widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);
}

function findWidget(state: DashboardState, id: string): WidgetState {
  const w = state.widgets.find((w) => w.id === id);
  if (!w) throw new Error(`Widget ${id} not found`);
  return w;
}

describe("applyOperation", () => {

  describe("reorder", () => {
    it("moves a widget from one position to another", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
        { id: "c", colSpan: 1, order: 2 },
      ]);

      const result = applyOperation(state, {
        type: "reorder",
        fromIndex: 0,
        toIndex: 2,
      });

      const sorted = visibleSorted(result);
      expect(sorted.map((w) => w.id)).toEqual(["b", "c", "a"]);
    });

    it("handles moving a widget backward", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
        { id: "c", colSpan: 1, order: 2 },
      ]);

      const result = applyOperation(state, {
        type: "reorder",
        fromIndex: 2,
        toIndex: 0,
      });

      const sorted = visibleSorted(result);
      expect(sorted.map((w) => w.id)).toEqual(["c", "a", "b"]);
    });

    it("returns equivalent state when reordering to same index", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
      ]);

      const result = applyOperation(state, {
        type: "reorder",
        fromIndex: 0,
        toIndex: 0,
      });

      const sorted = visibleSorted(result);
      expect(sorted.map((w) => w.id)).toEqual(["a", "b"]);
    });
  });

  describe("swap", () => {
    it("exchanges order values of two widgets", () => {
      const state = createState([
        { id: "a", colSpan: 2, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
        { id: "c", colSpan: 1, order: 2 },
      ]);

      const result = applyOperation(state, {
        type: "swap",
        sourceId: "a",
        targetId: "c",
      });

      expect(findWidget(result, "a").order).toBe(2);
      expect(findWidget(result, "c").order).toBe(0);
      expect(findWidget(result, "b").order).toBe(1);
    });

    it("only modifies the two swapped widgets", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
        { id: "c", colSpan: 1, order: 2 },
        { id: "d", colSpan: 1, order: 3 },
      ]);

      const result = applyOperation(state, {
        type: "swap",
        sourceId: "b",
        targetId: "d",
      });

      expect(findWidget(result, "a").order).toBe(0);
      expect(findWidget(result, "b").order).toBe(3);
      expect(findWidget(result, "c").order).toBe(2);
      expect(findWidget(result, "d").order).toBe(1);
    });

    it("swapping a widget with itself is a no-op in terms of order", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
      ]);

      const result = applyOperation(state, {
        type: "swap",
        sourceId: "a",
        targetId: "a",
      });

      expect(findWidget(result, "a").order).toBe(0);
      expect(findWidget(result, "b").order).toBe(1);
    });

    it("returns original state when source widget does not exist", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
      ]);

      const result = applyOperation(state, {
        type: "swap",
        sourceId: "nonexistent",
        targetId: "a",
      });

      expect(result).toBe(state);
    });

    it("returns original state when target widget does not exist", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
      ]);

      const result = applyOperation(state, {
        type: "swap",
        sourceId: "a",
        targetId: "nonexistent",
      });

      expect(result).toBe(state);
    });
  });

  describe("auto-resize", () => {
    it("resizes both widgets and places source adjacent to target", () => {
      const state = createState([
        { id: "a", colSpan: 4, order: 0 },
        { id: "b", colSpan: 4, order: 1 },
        { id: "c", colSpan: 4, order: 2 },
      ]);

      const result = applyOperation(state, {
        type: "auto-resize",
        sourceId: "a",
        targetId: "c",
        sourceSpan: 2,
        targetSpan: 2,
        targetIndex: 2,
      });

      expect(findWidget(result, "a").colSpan).toBe(2);
      expect(findWidget(result, "c").colSpan).toBe(2);
      expect(findWidget(result, "b").colSpan).toBe(4);

      const sorted = visibleSorted(result);
      const sourceIdx = sorted.findIndex((w) => w.id === "a");
      const targetIdx = sorted.findIndex((w) => w.id === "c");
      expect(Math.abs(sourceIdx - targetIdx)).toBe(1);
    });

    it("handles auto-resize when source is already adjacent", () => {
      const state = createState([
        { id: "a", colSpan: 4, order: 0 },
        { id: "b", colSpan: 4, order: 1 },
      ]);

      const result = applyOperation(state, {
        type: "auto-resize",
        sourceId: "a",
        targetId: "b",
        sourceSpan: 2,
        targetSpan: 2,
        targetIndex: 1,
      });

      expect(findWidget(result, "a").colSpan).toBe(2);
      expect(findWidget(result, "b").colSpan).toBe(2);
    });
  });

  describe("column-pin", () => {
    it("sets columnStart and moves widget to target position", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
        { id: "c", colSpan: 1, order: 2 },
      ]);

      const result = applyOperation(state, {
        type: "column-pin",
        sourceId: "a",
        column: 3,
        targetIndex: 2,
      });

      const pinned = findWidget(result, "a");
      expect(pinned.columnStart).toBe(3);

      const sorted = visibleSorted(result);
      expect(sorted[sorted.length - 1].id).toBe("a");
    });

    it("returns state unchanged when source does not exist", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
      ]);

      const result = applyOperation(state, {
        type: "column-pin",
        sourceId: "nonexistent",
        column: 2,
        targetIndex: 0,
      });

      expect(result).toBe(state);
    });

    it("does not set columnStart on other widgets", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
      ]);

      const result = applyOperation(state, {
        type: "column-pin",
        sourceId: "a",
        column: 2,
        targetIndex: 1,
      });

      expect(findWidget(result, "a").columnStart).toBe(2);
      expect(findWidget(result, "b").columnStart).toBeUndefined();
    });
  });

  describe("resize-toggle", () => {
    it("changes the colSpan of the target widget", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 2, order: 1 },
      ]);

      const result = applyOperation(state, {
        type: "resize-toggle",
        id: "b",
        newSpan: 4,
      });

      expect(findWidget(result, "b").colSpan).toBe(4);
      expect(findWidget(result, "a").colSpan).toBe(1);
    });

    it("clamps colSpan to maxColumns", () => {
      const state = createState([
        { id: "a", colSpan: 2, order: 0 },
      ]);

      const result = applyOperation(state, {
        type: "resize-toggle",
        id: "a",
        newSpan: 10,
      });

      expect(findWidget(result, "a").colSpan).toBe(4);
    });

    it("resizing to the same span still produces correct state", () => {
      const state = createState([
        { id: "a", colSpan: 2, order: 0 },
      ]);

      const result = applyOperation(state, {
        type: "resize-toggle",
        id: "a",
        newSpan: 2,
      });

      expect(findWidget(result, "a").colSpan).toBe(2);
    });
  });

  describe("cancelled", () => {
    it("returns the exact same state reference", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 2, order: 1 },
      ]);

      const result = applyOperation(state, { type: "cancelled" });

      expect(result).toBe(state);
    });
  });

  describe("hidden widgets", () => {
    it("reorder skips hidden widgets", () => {
      const state = createState([
        { id: "a", colSpan: 1, order: 0 },
        { id: "hidden", colSpan: 1, order: 1, visible: false },
        { id: "b", colSpan: 1, order: 2 },
      ]);

      const result = applyOperation(state, {
        type: "reorder",
        fromIndex: 0,
        toIndex: 1,
      });

      const sorted = visibleSorted(result);
      expect(sorted.map((w) => w.id)).toEqual(["b", "a"]);
    });
  });
});
