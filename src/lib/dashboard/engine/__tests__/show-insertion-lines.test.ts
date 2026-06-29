import { describe, it, expect } from "vitest";
import { DragEngine } from "../drag-engine.ts";
import type { DashboardState, WidgetState } from "../../types.ts";
import type { DragEngineConfig } from "../types.ts";

function makeWidgets(specs: Array<{ id: string; colSpan?: number; order: number }>): WidgetState[] {
  return specs.map((s) => ({ id: s.id, type: "test", colSpan: s.colSpan ?? 1, visible: true, order: s.order }));
}

function makeEngine(configOverrides?: Partial<DragEngineConfig>): DragEngine {
  const widgets = makeWidgets([
    { id: "a", order: 0 },
    { id: "b", order: 1 },
  ]);
  const state: DashboardState = { widgets, maxColumns: 2, gap: 16, containerWidth: 800 };
  const engine = new DragEngine(state, { maxColumns: 2, gap: 16, dropMode: "lines", ...configOverrides });
  engine.send({ type: "SET_CONTAINER", width: 800 });
  engine.send({ type: "SET_HEIGHTS", heights: new Map(widgets.map((w) => [w.id, 100])) });
  return engine;
}

function startDrag(engine: DragEngine): void {
  const aPos = engine.getSnapshot().layout.positions.get("a")!;
  const bPos = engine.getSnapshot().layout.positions.get("b")!;
  engine.send({ type: "POINTER_DOWN", id: "a", position: { x: aPos.x + 20, y: aPos.y + 20 }, timestamp: 0, pointerType: "mouse" });
  engine.send({ type: "POINTER_MOVE", position: { x: bPos.x + bPos.width / 2, y: bPos.y + bPos.height / 2 }, timestamp: 10 });
  engine.send({ type: "TICK", timestamp: 20 });
}

describe("DragEngine — showInsertionLines", () => {
  it("exposes insertion lines while dragging by default", () => {
    const engine = makeEngine();
    startDrag(engine);
    const snap = engine.getSnapshot();
    expect(snap.phase.type).toBe("dragging");
    expect(snap.insertionLines.length).toBeGreaterThan(0);
  });

  it("exposes no insertion lines when showInsertionLines is false", () => {
    const engine = makeEngine({ showInsertionLines: false });
    startDrag(engine);
    const snap = engine.getSnapshot();
    expect(snap.insertionLines).toEqual([]);
  });

  it("keeps drag fully functional with lines hidden (same phase + intent)", () => {
    const shown = makeEngine();
    const hidden = makeEngine({ showInsertionLines: false });
    startDrag(shown);
    startDrag(hidden);
    expect(hidden.getSnapshot().phase).toEqual(shown.getSnapshot().phase);
    expect(hidden.getSnapshot().intent).toEqual(shown.getSnapshot().intent);
  });
});
