import { describe, it, expect } from "vitest";
import { applyOperation } from "../operation-applier.ts";
import type { DashboardState, WidgetState } from "../../types.ts";

function makeState(specs: Array<{ id: string; colSpan: number; order: number }>): DashboardState {
  return {
    widgets: specs.map(
      (s): WidgetState => ({ id: s.id, type: "x", colSpan: s.colSpan, visible: true, order: s.order })
    ),
    maxColumns: 3,
    gap: 16,
    containerWidth: 800,
  };
}

function sortedIds(state: DashboardState): string[] {
  return state.widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order)
    .map((w) => w.id);
}

describe("applyOperation — new-row + in-row-insert", () => {
  it("new-row moves source and resizes to colSpan", () => {
    const state = makeState([
      { id: "a", colSpan: 1, order: 0 },
      { id: "src", colSpan: 1, order: 1 },
      { id: "b", colSpan: 1, order: 2 },
    ]);
    const result = applyOperation(state, {
      type: "new-row",
      sourceId: "src",
      insertionIndex: 0,
      colSpan: 3,
    });
    expect(sortedIds(result)).toEqual(["src", "a", "b"]);
    expect(result.widgets.find((w) => w.id === "src")!.colSpan).toBe(3);
  });

  it("new-row does not resize when colSpan unchanged", () => {
    const state = makeState([
      { id: "a", colSpan: 1, order: 0 },
      { id: "src", colSpan: 3, order: 1 },
    ]);
    const result = applyOperation(state, {
      type: "new-row",
      sourceId: "src",
      insertionIndex: 0,
      colSpan: 3,
    });
    expect(sortedIds(result)).toEqual(["src", "a"]);
    expect(result.widgets.find((w) => w.id === "src")!.colSpan).toBe(3);
  });

  it("in-row-insert applies all resizes and reorders source", () => {
    const state = makeState([
      { id: "a", colSpan: 2, order: 0 },
      { id: "b", colSpan: 1, order: 1 },
      { id: "src", colSpan: 2, order: 2 },
    ]);
    const result = applyOperation(state, {
      type: "in-row-insert",
      sourceId: "src",
      insertionIndex: 1,
      resize: [
        { id: "a", newSpan: 1 },
        { id: "b", newSpan: 1 },
        { id: "src", newSpan: 1 },
      ],
    });
    expect(sortedIds(result)).toEqual(["a", "src", "b"]);
    expect(result.widgets.find((w) => w.id === "a")!.colSpan).toBe(1);
    expect(result.widgets.find((w) => w.id === "b")!.colSpan).toBe(1);
    expect(result.widgets.find((w) => w.id === "src")!.colSpan).toBe(1);
  });

  it("in-row-insert without any resize still reorders", () => {
    const state = makeState([
      { id: "a", colSpan: 1, order: 0 },
      { id: "b", colSpan: 1, order: 1 },
      { id: "src", colSpan: 1, order: 2 },
    ]);
    const result = applyOperation(state, {
      type: "in-row-insert",
      sourceId: "src",
      insertionIndex: 1,
      resize: [],
    });
    expect(sortedIds(result)).toEqual(["a", "src", "b"]);
  });
});
