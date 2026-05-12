import { describe, it, expect } from "vitest";
import { findSnappedLine } from "../insertion-lines.ts";
import type { InsertionLine } from "../types.ts";

function vLine(id: string, x: number, y1: number, y2: number, disabled = false): InsertionLine {
  return {
    id, orientation: "vertical",
    x1: x, y1, x2: x, y2,
    insertionIndex: 0,
    beforeId: null, afterId: null,
    isActive: false, disabled,
  };
}

function hLine(id: string, y: number, x1: number, x2: number): InsertionLine {
  return {
    id, orientation: "horizontal",
    x1, y1: y, x2, y2: y,
    insertionIndex: 0,
    beforeId: null, afterId: null,
    isActive: false, disabled: false,
  };
}

describe("findSnappedLine", () => {
  it("returns null when no lines are within snap radius", () => {
    const lines = [vLine("v1", 100, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 200, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result).toBeNull();
  });

  it("snaps to the closest V-line within the radius", () => {
    const lines = [vLine("v1", 100, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 110, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result?.id).toBe("v1");
  });

  it("returns null when the pointer is above/below a V-line segment beyond the snap radius", () => {
    const lines = [vLine("v1", 100, 100, 200)];
    const result = findSnappedLine({ pointer: { x: 110, y: 50 }, lines, snapRadius: 16, previousLineId: null });
    expect(result).toBeNull();
  });

  it("skips disabled lines", () => {
    const lines = [vLine("v1", 100, 0, 200, true)];
    const result = findSnappedLine({ pointer: { x: 110, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result).toBeNull();
  });

  it("picks the closest of two competing lines", () => {
    const lines = [vLine("v1", 100, 0, 200), vLine("v2", 130, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 125, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result?.id).toBe("v2");
  });

  it("applies hysteresis: keeps the previous line when within exit radius", () => {
    const lines = [vLine("v1", 100, 0, 200), vLine("v2", 130, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 120, y: 100 }, lines, snapRadius: 16, previousLineId: "v1" });
    expect(result?.id).toBe("v1");
  });

  it("releases the previous line once past exit threshold", () => {
    const lines = [vLine("v1", 100, 0, 200), vLine("v2", 130, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 125, y: 100 }, lines, snapRadius: 16, previousLineId: "v1" });
    expect(result?.id).toBe("v2");
  });

  it("snaps to H-lines using perpendicular distance", () => {
    const lines = [hLine("h1", 50, 0, 800)];
    const result = findSnappedLine({ pointer: { x: 400, y: 60 }, lines, snapRadius: 16, previousLineId: null });
    expect(result?.id).toBe("h1");
  });
});
