import { describe, it, expect } from "vitest";
import { zonesEqual } from "../utils.ts";
import type { DropZone } from "../types.ts";

describe("zonesEqual — insertion-line zones", () => {
  it("considers two identical insertion-line-h zones equal", () => {
    const a: DropZone = { type: "insertion-line-h", lineId: "h-null-w1-", insertionIndex: 0, beforeId: null, afterId: "w1" };
    const b: DropZone = { type: "insertion-line-h", lineId: "h-null-w1-", insertionIndex: 0, beforeId: null, afterId: "w1" };
    expect(zonesEqual(a, b)).toBe(true);
  });

  it("treats different lineIds as not equal", () => {
    const a: DropZone = { type: "insertion-line-h", lineId: "h-null-w1-", insertionIndex: 0, beforeId: null, afterId: "w1" };
    const b: DropZone = { type: "insertion-line-h", lineId: "h-w1-w2-", insertionIndex: 1, beforeId: "w1", afterId: "w2" };
    expect(zonesEqual(a, b)).toBe(false);
  });

  it("considers two identical insertion-line-v zones equal", () => {
    const a: DropZone = { type: "insertion-line-v", lineId: "v-w1-w2-", insertionIndex: 1, beforeId: "w1", afterId: "w2" };
    const b: DropZone = { type: "insertion-line-v", lineId: "v-w1-w2-", insertionIndex: 1, beforeId: "w1", afterId: "w2" };
    expect(zonesEqual(a, b)).toBe(true);
  });

  it("does not confuse insertion-line-h with insertion-line-v of same id", () => {
    const a: DropZone = { type: "insertion-line-h", lineId: "x", insertionIndex: 0, beforeId: null, afterId: null };
    const b: DropZone = { type: "insertion-line-v", lineId: "x", insertionIndex: 0, beforeId: null, afterId: null };
    expect(zonesEqual(a, b)).toBe(false);
  });
});
