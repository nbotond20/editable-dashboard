import { describe, it, expect } from "vitest";
import { computeEmptySlots } from "../../layout/compute-empty-slots.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";

function layout(
  positions: Array<{ id: string; x: number; y: number; width: number; height: number; colSpan: number }>,
): ComputedLayout {
  let bottom = 0;
  for (const p of positions) bottom = Math.max(bottom, p.y + p.height);
  return { positions: new Map(positions.map((p) => [p.id, { ...p }])), totalHeight: bottom };
}

function widget(id: string, colSpan: number, order: number): WidgetState {
  return { id, type: "x", colSpan, visible: true, order };
}

describe("computeEmptySlots", () => {
  it("returns one full-width slot for an empty dashboard", () => {
    const slots = computeEmptySlots({ positions: new Map(), totalHeight: 0 }, [], 2, 16, 528);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      rowIndex: 0,
      columnStart: 0,
      colSpan: 2,
      beforeId: null,
      afterId: null,
      anchorId: null,
      x: 0,
      y: 0,
      width: 528,
    });
  });

  it("places a trailing-free-column slot beside the row's anchor (simple case)", () => {
    // chart(2) fills row 0; stats(1) leaves col 1 free on row 1.
    const lay = layout([
      { id: "chart", x: 0, y: 0, width: 528, height: 200, colSpan: 2 },
      { id: "stats", x: 0, y: 216, width: 256, height: 200, colSpan: 1 },
    ]);
    const ws = [widget("chart", 2, 0), widget("stats", 1, 1)];
    const slots = computeEmptySlots(lay, ws, 2, 16, 528);

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      columnStart: 1,
      colSpan: 1,
      beforeId: "stats",
      afterId: null,
      anchorId: "stats",
      x: 272,
      y: 216,
      height: 200,
    });
  });

  it("places a leading-free-column slot to the left of a right-aligned widget", () => {
    // chart(2) fills row 0; planned(1) sits in col 1 on row 1, leaving col 0 free.
    const lay = layout([
      { id: "chart", x: 0, y: 0, width: 528, height: 200, colSpan: 2 },
      { id: "planned", x: 272, y: 216, width: 256, height: 200, colSpan: 1 },
    ]);
    const ws = [widget("chart", 2, 0), widget("planned", 1, 1)];
    const slots = computeEmptySlots(lay, ws, 2, 16, 528);

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      columnStart: 0,
      colSpan: 1,
      beforeId: null,
      afterId: "planned",
      anchorId: "planned",
      x: 0,
      y: 216,
      height: 200,
    });
  });

  it("flows the slot up to fill the gap a short adjacent-column widget leaves open", () => {
    // tall(col0) + short(col1) on row 0; low(col0) on row 1. col 1 is free from short's
    // bottom all the way down — the slot must start just below short, not at low's row.
    const lay = layout([
      { id: "tall", x: 0, y: 0, width: 256, height: 600, colSpan: 1 },
      { id: "short", x: 272, y: 0, width: 256, height: 200, colSpan: 1 },
      { id: "low", x: 0, y: 616, width: 256, height: 300, colSpan: 1 },
    ]);
    const ws = [widget("tall", 1, 0), widget("short", 1, 1), widget("low", 1, 2)];
    const slots = computeEmptySlots(lay, ws, 2, 16, 528);

    const slot = slots.find((s) => s.columnStart === 1);
    expect(slot).toBeDefined();
    expect(slot!.y).toBe(216); // short.bottom (200) + gap (16)
    expect(slot!.y + slot!.height).toBe(lay.totalHeight); // flows to the content bottom
  });

  it("merges two stacked trailing gaps in the same column into one slot", () => {
    // Two half widgets pinned to col 0 in separate rows both leave col 1 free.
    // The free column is continuous, so it must read as a single placeholder.
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 200, colSpan: 1 },
      { id: "b", x: 0, y: 216, width: 256, height: 200, colSpan: 1 },
    ]);
    const ws = [widget("a", 1, 0), widget("b", 1, 1)];
    const slots = computeEmptySlots(lay, ws, 2, 16, 528);

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ columnStart: 1, colSpan: 1, x: 272, y: 0 });
    // spans the full height of both rows (0 .. b.bottom).
    expect(slots[0].y + slots[0].height).toBe(416);
  });

  it("starts the slot below a taller adjacent-column widget so it never overlaps", () => {
    // chart(col0, short) + calendar(col1, tall) on row 0; notes(col0) on row 1.
    // The free col-1 slot beside notes must clear calendar, not start at notes.y.
    const lay = layout([
      { id: "chart", x: 0, y: 0, width: 256, height: 400, colSpan: 1 },
      { id: "calendar", x: 272, y: 0, width: 256, height: 500, colSpan: 1 },
      { id: "notes", x: 0, y: 416, width: 256, height: 300, colSpan: 1 },
    ]);
    const ws = [widget("chart", 1, 0), widget("calendar", 1, 1), widget("notes", 1, 2)];
    const slots = computeEmptySlots(lay, ws, 2, 16, 528);

    const slot = slots.find((s) => s.anchorId === "notes");
    expect(slot).toBeDefined();
    // calendar bottom is 500; slot must start at or below it (516 = 500 + gap).
    expect(slot!.y).toBeGreaterThanOrEqual(500);
    expect(slot!.y).toBe(516);
    // and must not run past the bottom of the content.
    expect(slot!.y + slot!.height).toBeLessThanOrEqual(lay.totalHeight);
  });

  it("clips the slot above a full-width widget below so it never overlaps", () => {
    // chart(col0, short) + calendar(col1, tall) on row 0; notes(col0) on row 1;
    // promo(full width) on row 2 below both columns. The free col-1 slot beside
    // notes must stop above promo, not run its full row height into it.
    const lay = layout([
      { id: "chart", x: 0, y: 0, width: 256, height: 400, colSpan: 1 },
      { id: "calendar", x: 272, y: 0, width: 256, height: 500, colSpan: 1 },
      { id: "notes", x: 0, y: 416, width: 256, height: 300, colSpan: 1 },
      { id: "promo", x: 0, y: 732, width: 528, height: 200, colSpan: 2 },
    ]);
    const ws = [widget("chart", 1, 0), widget("calendar", 1, 1), widget("notes", 1, 2), widget("promo", 2, 3)];
    const slots = computeEmptySlots(lay, ws, 2, 16, 528);

    const slot = slots.find((s) => s.anchorId === "notes");
    expect(slot).toBeDefined();
    // promo top is 732; the slot must clear it by at least the gap.
    expect(slot!.y + slot!.height).toBeLessThanOrEqual(732 - 16);
  });

  it("drops the slot when the free columns are occupied to the bottom of the content", () => {
    // calendar(col1) is the tallest column — col 1 has no free space beside notes.
    const lay = layout([
      { id: "chart", x: 0, y: 0, width: 256, height: 200, colSpan: 1 },
      { id: "calendar", x: 272, y: 0, width: 256, height: 400, colSpan: 1 },
      { id: "notes", x: 0, y: 216, width: 256, height: 100, colSpan: 1 },
    ]);
    const ws = [widget("chart", 1, 0), widget("calendar", 1, 1), widget("notes", 1, 2)];
    const slots = computeEmptySlots(lay, ws, 2, 16, 528);

    expect(slots.find((s) => s.anchorId === "notes")).toBeUndefined();
  });
});
