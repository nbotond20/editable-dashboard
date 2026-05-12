import { describe, it, expect } from "vitest";
import { equalDistribute } from "../equal-distribute.ts";

function freeConstraints() {
  return () => ({ minSpan: 1, maxSpan: Infinity });
}
function neverLocked() {
  return () => false;
}

describe("equalDistribute", () => {
  it("returns empty resize when total fits maxColumns", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 1 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 1,
      sourceOriginalSpan: 1,
      maxColumns: 3,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).toEqual({ resize: [] });
  });

  it("equally splits when overflow happens", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 2,
      sourceOriginalSpan: 2,
      maxColumns: 3,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).not.toBeNull();
    const resize = result!.resize.slice().sort((x, y) => x.id.localeCompare(y.id));
    expect(resize).toEqual([
      { id: "a", newSpan: 1 },
      { id: "s", newSpan: 1 },
    ]);
  });

  it("distributes remainder left-to-right (only changed widgets in resize)", () => {
    // 3 widgets in 4 cols: base=1, rem=1 → distribution [2, 1, 1]
    // a was 2, stays 2 (skipped); b was 2 shrinks to 1; s was 2 shrinks to 1
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 2 }],
      sourceId: "s",
      sourceSpan: 2,
      sourceOriginalSpan: 2,
      maxColumns: 4,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).not.toBeNull();
    const resize = result!.resize.slice().sort((x, y) => x.id.localeCompare(y.id));
    expect(resize).toEqual([
      { id: "b", newSpan: 1 },
      { id: "s", newSpan: 1 },
    ]);
  });

  it("returns null when minSpan would be violated", () => {
    // a=2, b=1, s=1 in max=3 → total=4. n=3, base=1, rem=0 → all get 1.
    // a has minSpan=2 → target[a]=1 < 2 → null.
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 1,
      sourceOriginalSpan: 1,
      maxColumns: 3,
      getWidgetConstraints: (id) => (id === "a" ? { minSpan: 2, maxSpan: Infinity } : { minSpan: 1, maxSpan: Infinity }),
      isResizeLocked: neverLocked(),
    });
    expect(result).toBeNull();
  });

  it("returns null when a resize-locked stationary would be shrunk", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 2,
      sourceOriginalSpan: 2,
      maxColumns: 3,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: (id) => id === "a",
    });
    expect(result).toBeNull();
  });

  it("omits resize entries for widgets whose span is unchanged", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 1,
      sourceOriginalSpan: 1,
      maxColumns: 2,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).toEqual({ resize: [] });
  });
});
