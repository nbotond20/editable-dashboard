import { describe, it, expect } from "vitest";
import { DragEngine } from "../drag-engine.ts";
import type { DashboardState, WidgetState } from "../../types.ts";
import type { DragEngineConfig } from "../types.ts";

// ─── Helpers ─────────────────────────────────────────────────

function makeWidget(id: string, order: number, colSpan = 1): WidgetState {
  return { id, type: "test", colSpan, visible: true, order };
}

function setup(
  widgets: WidgetState[],
  configOverrides?: Partial<DragEngineConfig>,
): DragEngine {
  const state: DashboardState = {
    widgets,
    maxColumns: 4,
    gap: 16,
    containerWidth: 1000,
  };
  const engine = new DragEngine(state, {
    maxColumns: 4,
    gap: 16,
    swapDwellMs: 200,
    resizeDwellMs: 600,
    dropAnimationDuration: 0, // instant drops for testing
    ...configOverrides,
  });
  engine.send({ type: "SET_CONTAINER", width: 1000 });
  engine.send({
    type: "SET_HEIGHTS",
    heights: new Map(widgets.filter((w) => w.visible).map((w) => [w.id, 100])),
  });
  return engine;
}

function getVisibleOrder(engine: DragEngine): string[] {
  return engine
    .getState()
    .widgets.filter((w) => w.visible)
    .sort((a, b) => a.order - b.order)
    .map((w) => w.id);
}

function activateDrag(engine: DragEngine, widgetId: string): void {
  const pos = engine.getSnapshot().layout.positions.get(widgetId);
  if (!pos) throw new Error(`Widget ${widgetId} not in layout`);

  const startPos = { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };
  engine.send({
    type: "POINTER_DOWN",
    id: widgetId,
    position: startPos,
    timestamp: 0,
    pointerType: "mouse",
  });
  // Move past activation threshold + tick to activate
  engine.send({
    type: "POINTER_MOVE",
    position: { x: startPos.x + 10, y: startPos.y },
    timestamp: 10,
  });
  // TICK to process the activation
  engine.send({ type: "TICK", timestamp: 11 });
  expect(engine.getSnapshot().phase.type).toBe("dragging");
}

/** Move pointer to a position and tick enough frames for the zone to commit
 *  through the 2-frame debounce. */
function moveAndStabilize(
  engine: DragEngine,
  position: { x: number; y: number },
  startTimestamp: number,
): number {
  engine.send({ type: "POINTER_MOVE", position, timestamp: startTimestamp });
  // 3 ticks to pass the 2-frame zone debounce
  engine.send({ type: "TICK", timestamp: startTimestamp + 1 });
  engine.send({ type: "TICK", timestamp: startTimestamp + 2 });
  engine.send({ type: "TICK", timestamp: startTimestamp + 3 });
  return startTimestamp + 3;
}

// ─── Integration Tests ───────────────────────────────────────

describe("Integration: complete drag sequences", () => {
  describe("swap via dwell", () => {
    it("swaps two widgets when dwelling over the target past swap threshold", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
        makeWidget("c", 2),
        makeWidget("d", 3),
      ]);

      expect(getVisibleOrder(engine)).toEqual(["a", "b", "c", "d"]);

      activateDrag(engine, "a");

      // Move to widget C's center and stabilize zone
      const cPos = engine.getSnapshot().layout.positions.get("c")!;
      const t = moveAndStabilize(
        engine,
        { x: cPos.x + cPos.width / 2, y: cPos.y + cPos.height / 2 },
        100,
      );

      // Dwell past swap threshold (200ms from zone entry)
      engine.send({ type: "TICK", timestamp: t + 300 });
      expect(engine.getSnapshot().intent?.type).toBe("swap");

      // Drop
      engine.send({ type: "POINTER_UP", timestamp: t + 400 });
      engine.send({ type: "TICK", timestamp: t + 500 });

      const order = getVisibleOrder(engine);
      expect(order.indexOf("c")).toBeLessThan(order.indexOf("a"));
    });
  });

  describe("auto-resize via long dwell", () => {
    it("resizes and places adjacent when dwelling long enough", () => {
      const engine = setup([
        makeWidget("a", 0, 3),
        makeWidget("b", 1, 3),
      ]);

      expect(getVisibleOrder(engine)).toEqual(["a", "b"]);

      activateDrag(engine, "a");

      // Move to widget B's center and stabilize zone
      const bPos = engine.getSnapshot().layout.positions.get("b")!;
      const t = moveAndStabilize(
        engine,
        { x: bPos.x + bPos.width / 2, y: bPos.y + bPos.height / 2 },
        100,
      );

      // Dwell past resize threshold (600ms from zone entry)
      engine.send({ type: "TICK", timestamp: t + 700 });
      const intent = engine.getSnapshot().intent;
      expect(intent?.type).toBe("auto-resize");

      // Drop
      engine.send({ type: "POINTER_UP", timestamp: t + 800 });
      engine.send({ type: "TICK", timestamp: t + 900 });

      const stateAfter = engine.getState();
      const a = stateAfter.widgets.find((w) => w.id === "a");
      const b = stateAfter.widgets.find((w) => w.id === "b");
      // Source (a) keeps its span clamped to maxColumns-1=3, target (b) gets the rest=1
      expect(a!.colSpan).toBe(3);
      expect(b!.colSpan).toBe(1);
    });
  });

  describe("reorder via gap zone", () => {
    it("reorders when dropping into a gap zone", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
        makeWidget("c", 2),
        makeWidget("d", 3),
      ]);

      activateDrag(engine, "a");

      // Move to the gap area after widget D
      const dPos = engine.getSnapshot().layout.positions.get("d")!;
      const t = moveAndStabilize(
        engine,
        { x: dPos.x + dPos.width + 10, y: dPos.y + dPos.height / 2 },
        50,
      );

      const snap = engine.getSnapshot();
      if (snap.intent?.type === "reorder") {
        engine.send({ type: "POINTER_UP", timestamp: t + 50 });
        engine.send({ type: "TICK", timestamp: t + 100 });

        const order = getVisibleOrder(engine);
        expect(order[order.length - 1]).toBe("a");
      }
    });
  });

  describe("cancel mid-drag", () => {
    it("reverts state when drag is cancelled", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
      ]);

      const initialState = engine.getState();
      activateDrag(engine, "a");

      engine.send({
        type: "POINTER_MOVE",
        position: { x: 500, y: 50 },
        timestamp: 50,
      });

      engine.send({ type: "CANCEL", timestamp: 100 });

      expect(engine.getSnapshot().phase.type).toBe("idle");
      expect(engine.getState()).toBe(initialState);
    });

    it("POINTER_CANCEL reverts state", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
      ]);

      const initialState = engine.getState();
      activateDrag(engine, "a");

      engine.send({ type: "POINTER_CANCEL", timestamp: 50 });
      expect(engine.getState()).toBe(initialState);
    });
  });

  describe("keyboard complete flow", () => {
    it("moves widget from first to third position", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
        makeWidget("c", 2),
        makeWidget("d", 3),
      ]);

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      engine.send({ type: "KEY_MOVE", direction: "down", timestamp: 100 });
      engine.send({ type: "KEY_MOVE", direction: "down", timestamp: 200 });
      engine.send({ type: "KEY_DROP", timestamp: 300 });

      const order = getVisibleOrder(engine);
      expect(order).toEqual(["b", "c", "a", "d"]);
    });

    it("resizes and moves via keyboard", () => {
      const engine = setup([
        makeWidget("a", 0, 1),
        makeWidget("b", 1, 1),
      ]);

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      engine.send({ type: "KEY_RESIZE", direction: "grow", timestamp: 100 });
      engine.send({ type: "KEY_RESIZE", direction: "grow", timestamp: 200 });
      engine.send({ type: "KEY_DROP", timestamp: 300 });

      const widget = engine.getState().widgets.find((w) => w.id === "a");
      expect(widget!.colSpan).toBe(3);
    });

    it("keyboard cancel at any point reverts everything", () => {
      const engine = setup([
        makeWidget("a", 0, 1),
        makeWidget("b", 1, 1),
      ]);

      const initial = engine.getState();
      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      engine.send({ type: "KEY_MOVE", direction: "down", timestamp: 100 });
      engine.send({ type: "KEY_RESIZE", direction: "grow", timestamp: 200 });
      engine.send({ type: "KEY_CANCEL", timestamp: 300 });

      expect(engine.getState()).toBe(initial);
    });
  });

  describe("dwell progress", () => {
    it("progress increases as dwell time passes over a widget zone", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
      ]);

      activateDrag(engine, "a");

      // Move to widget B and stabilize the zone (2-frame debounce)
      const bPos = engine.getSnapshot().layout.positions.get("b")!;
      const t = moveAndStabilize(
        engine,
        { x: bPos.x + bPos.width / 2, y: bPos.y + bPos.height / 2 },
        100,
      );

      // At t, zone just committed. Dwell starts from zone entry.
      // Tick with enough time for partial dwell
      engine.send({ type: "TICK", timestamp: t + 100 });
      expect(engine.getSnapshot().dwellProgress).toBeCloseTo(0.5, 1);

      // Past swap threshold → progress resets for resize phase
      engine.send({ type: "TICK", timestamp: t + 200 });
      expect(engine.getSnapshot().dwellProgress).toBeCloseTo(0, 1);
    });
  });

  describe("undo/redo after drag operations", () => {
    it("undo reverts a swap", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
        makeWidget("c", 2),
        makeWidget("d", 3),
      ]);

      const initialOrder = getVisibleOrder(engine);

      // Perform swap: A onto C
      activateDrag(engine, "a");
      const cPos = engine.getSnapshot().layout.positions.get("c")!;
      const t = moveAndStabilize(
        engine,
        { x: cPos.x + cPos.width / 2, y: cPos.y + cPos.height / 2 },
        100,
      );
      engine.send({ type: "TICK", timestamp: t + 300 }); // past swap dwell
      engine.send({ type: "POINTER_UP", timestamp: t + 400 });
      engine.send({ type: "TICK", timestamp: t + 500 });

      const afterSwap = getVisibleOrder(engine);
      expect(afterSwap).not.toEqual(initialOrder);

      engine.dispatch({ type: "UNDO" });
      expect(getVisibleOrder(engine)).toEqual(initialOrder);

      engine.dispatch({ type: "REDO" });
      expect(getVisibleOrder(engine)).toEqual(afterSwap);
    });
  });

  describe("drag position calculation", () => {
    it("dragPosition reflects pointer minus grab offset", () => {
      const engine = setup([
        makeWidget("a", 0, 1),
        makeWidget("b", 1, 1),
      ]);

      const aPos = engine.getSnapshot().layout.positions.get("a")!;
      const startPos = {
        x: aPos.x + aPos.width / 2,
        y: aPos.y + aPos.height / 2,
      };

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: startPos,
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: startPos.x + 10, y: startPos.y },
        timestamp: 10,
      });

      const snap = engine.getSnapshot();
      expect(snap.dragPosition).not.toBeNull();
      if (snap.dragPosition && snap.phase.type === "dragging") {
        expect(snap.dragPosition.x).toBeCloseTo(aPos.x + 10, 0);
      }
    });
  });

  describe("multiple rapid zone transitions", () => {
    it("handles rapid pointer movement across zones without breaking", () => {
      const engine = setup([
        makeWidget("a", 0),
        makeWidget("b", 1),
        makeWidget("c", 2),
        makeWidget("d", 3),
      ]);

      activateDrag(engine, "a");

      const ids = ["b", "c", "d"];
      let t = 20;
      for (const id of ids) {
        const pos = engine.getSnapshot().layout.positions.get(id)!;
        engine.send({
          type: "POINTER_MOVE",
          position: { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 },
          timestamp: t,
        });
        engine.send({ type: "TICK", timestamp: t + 1 });
        t += 5;
      }

      expect(engine.getSnapshot().phase.type).toBe("dragging");

      // Rapid back and forth
      for (let i = 0; i < 20; i++) {
        const id = ids[i % ids.length];
        const pos = engine.getSnapshot().layout.positions.get(id)!;
        engine.send({
          type: "POINTER_MOVE",
          position: { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 },
          timestamp: t,
        });
        engine.send({ type: "TICK", timestamp: t + 1 });
        t += 2;
      }

      expect(engine.getSnapshot().phase.type).toBe("dragging");

      engine.send({ type: "POINTER_CANCEL", timestamp: t });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });
  });
});
