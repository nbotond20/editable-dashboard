import { describe, it, expect } from "vitest";
import { DragEngine } from "../drag-engine.ts";
import type { DashboardState, WidgetState } from "../../types.ts";
import type { DragEngineConfig } from "../types.ts";

function widgets(
  specs: Array<{ id: string; colSpan?: number; order: number }>
): WidgetState[] {
  return specs.map((s) => ({
    id: s.id,
    type: "test",
    colSpan: s.colSpan ?? 1,
    visible: true,
    order: s.order,
  }));
}

function state(w: WidgetState[], maxColumns = 2): DashboardState {
  return { widgets: w, maxColumns, gap: 16, containerWidth: 800 };
}

function heights(ids: string[]): ReadonlyMap<string, number> {
  return new Map(ids.map((id) => [id, 100]));
}

function makeEngine(overrides?: Partial<DragEngineConfig>): DragEngine {
  const w = widgets([
    { id: "a", order: 0 },
    { id: "b", order: 1 },
    { id: "c", order: 2 },
    { id: "d", order: 3 },
  ]);
  const engine = new DragEngine(state(w), {
    maxColumns: 2,
    gap: 16,
    dropMode: "lines",
    ...overrides,
  });
  engine.send({ type: "SET_CONTAINER", width: 800 });
  engine.send({ type: "SET_HEIGHTS", heights: heights(["a", "b", "c", "d"]) });
  return engine;
}

function startDrag(engine: DragEngine, id: string, pos = { x: 0, y: 0 }): void {
  engine.send({
    type: "POINTER_DOWN",
    id,
    position: pos,
    timestamp: 0,
    pointerType: "mouse",
  });
  engine.send({
    type: "POINTER_MOVE",
    position: { x: pos.x + 20, y: pos.y + 20 },
    timestamp: 50,
  });
  engine.send({ type: "TICK", timestamp: 60 });
}

function movePointer(engine: DragEngine, pos: { x: number; y: number }, timestamp: number): void {
  engine.send({ type: "POINTER_MOVE", position: pos, timestamp });
  engine.send({ type: "TICK", timestamp: timestamp + 1 });
}

describe("lineProximityRadius", () => {
  it("exposes all lines when lineProximityRadius is unset", () => {
    const engine = makeEngine();
    startDrag(engine, "a");
    movePointer(engine, { x: 100, y: 100 }, 100);

    const lines = engine.getSnapshot().insertionLines;
    expect(lines.length).toBeGreaterThan(0);
    const baseline = lines.length;

    movePointer(engine, { x: 10000, y: 10000 }, 200);
    expect(engine.getSnapshot().insertionLines.length).toBe(baseline);
  });

  it("filters lines further than lineProximityRadius from pointer", () => {
    const engine = makeEngine({ lineProximityRadius: 50 });
    startDrag(engine, "a");

    movePointer(engine, { x: 10000, y: 10000 }, 100);
    const farLines = engine.getSnapshot().insertionLines;
    expect(farLines.length).toBe(0);
  });

  it("includes lines within radius and excludes those outside", () => {
    const engine = makeEngine({ lineProximityRadius: 30 });
    startDrag(engine, "a");
    movePointer(engine, { x: 400, y: 50 }, 100);
    const filtered = engine.getSnapshot().insertionLines;

    const engineAll = makeEngine();
    startDrag(engineAll, "a");
    movePointer(engineAll, { x: 400, y: 50 }, 100);
    const all = engineAll.getSnapshot().insertionLines;

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(all.length);
  });

  it("returns empty when not dragging", () => {
    const engine = makeEngine({ lineProximityRadius: 100 });
    expect(engine.getSnapshot().insertionLines.length).toBe(0);
  });

  it("trims segments within a kept line to those near the pointer", () => {
    const engine = makeEngine({ lineProximityRadius: 30 });
    startDrag(engine, "a");
    movePointer(engine, { x: 50, y: 200 }, 100);

    const filtered = engine.getSnapshot().insertionLines;
    expect(filtered.length).toBeGreaterThan(0);

    const engineAll = makeEngine();
    startDrag(engineAll, "a");
    movePointer(engineAll, { x: 50, y: 200 }, 100);
    const all = engineAll.getSnapshot().insertionLines;

    const findById = (lines: typeof filtered, id: string) =>
      lines.find((l) => l.id === id);

    let trimmed = 0;
    for (const f of filtered) {
      const original = findById(all, f.id);
      if (!original?.segments || !f.segments) continue;
      if (f.segments.length < original.segments.length) trimmed++;
    }
    expect(trimmed).toBeGreaterThan(0);
  });
});
