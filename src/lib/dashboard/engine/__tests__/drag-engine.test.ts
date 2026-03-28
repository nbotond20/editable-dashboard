import { describe, it, expect, vi } from "vitest";
import { DragEngine } from "../drag-engine.ts";
import type { DashboardState, WidgetState } from "../../types.ts";
import type { DragEngineConfig } from "../types.ts";

function makeWidgets(
  specs: Array<{ id: string; colSpan?: number; order: number; visible?: boolean }>
): WidgetState[] {
  return specs.map((s) => ({
    id: s.id,
    type: "test",
    colSpan: s.colSpan ?? 1,
    visible: s.visible ?? true,
    order: s.order,
  }));
}

function makeState(
  widgets: WidgetState[],
  overrides?: Partial<DashboardState>
): DashboardState {
  return {
    widgets,
    maxColumns: 2,
    gap: 16,
    containerWidth: 800,
    ...overrides,
  };
}

function makeHeights(ids: string[], height = 100): ReadonlyMap<string, number> {
  return new Map(ids.map((id) => [id, height]));
}

function createTestEngine(
  widgets: Array<{ id: string; colSpan?: number; order: number; visible?: boolean }>,
  configOverrides?: Partial<DragEngineConfig>
): DragEngine {
  const w = makeWidgets(widgets);
  const state = makeState(w);
  const engine = new DragEngine(state, {
    maxColumns: 2,
    gap: 16,
    ...configOverrides,
  });
  engine.send({
    type: "SET_CONTAINER",
    width: 800,
  });
  engine.send({
    type: "SET_HEIGHTS",
    heights: makeHeights(w.filter((x) => x.visible).map((x) => x.id)),
  });
  return engine;
}

describe("DragEngine", () => {
  describe("detached method calls (useSyncExternalStore contract)", () => {
    it("getSnapshot works when destructured from the engine", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const { getSnapshot } = engine;
      const snap = getSnapshot();
      expect(snap.phase.type).toBe("idle");
    });

    it("subscribe works when destructured from the engine", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const { subscribe } = engine;
      const listener = vi.fn();
      const unsub = subscribe(listener);
      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      expect(listener).toHaveBeenCalled();
      unsub();
    });

    it("send works when destructured from the engine", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const { send, getSnapshot } = engine;
      send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      expect(getSnapshot().phase.type).toBe("pending");
    });

    it("dispatch works when destructured from the engine", () => {
      const engine = createTestEngine([{ id: "a", colSpan: 1, order: 0 }]);
      const { dispatch, getState } = engine;
      dispatch({ type: "RESIZE_WIDGET", id: "a", colSpan: 2 });
      expect(getState().widgets[0].colSpan).toBe(2);
    });

    it("getSnapshot returns consistent snapshots between subscribe notifications", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const { subscribe, getSnapshot } = engine;

      const snapshots: unknown[] = [];
      subscribe(() => {
        snapshots.push(getSnapshot());
      });

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: 110, y: 50 },
        timestamp: 10,
      });

      expect(snapshots.length).toBe(2);
      expect(snapshots[0]).not.toBe(snapshots[1]);
    });
  });

  describe("updateConfig does not notify (safe for React render cycle)", () => {
    it("updateConfig does not fire subscriber callbacks", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.updateConfig({ maxColumns: 4 });

      expect(listener).not.toHaveBeenCalled();
    });

    it("getSnapshot reflects config changes without notify", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      engine.updateConfig({ maxColumns: 4 });

      const snap = engine.getSnapshot();
      expect(snap.layout).toBeDefined();
    });
  });

  describe("no infinite re-render loops (useSyncExternalStore stability)", () => {
    it("send(SET_HEIGHTS) with same data does not notify", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      engine.getSnapshot();

      const listener = vi.fn();
      engine.subscribe(listener);

      const heights = makeHeights(["a", "b"]);
      engine.send({ type: "SET_HEIGHTS", heights });
      const callsAfterFirst = listener.mock.calls.length;

      engine.send({ type: "SET_HEIGHTS", heights });
      expect(listener.mock.calls.length).toBe(callsAfterFirst);
    });

    it("send(SET_CONTAINER) with same dimensions does not notify", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      engine.getSnapshot();

      const listener = vi.fn();
      engine.subscribe(listener);

      engine.send({
        type: "SET_CONTAINER",
        width: 800,
      });
      const callsAfterFirst = listener.mock.calls.length;

      engine.send({
        type: "SET_CONTAINER",
        width: 800,
      });
      expect(listener.mock.calls.length).toBe(callsAfterFirst);
    });

    it("getSnapshot returns same reference when same heights ref is sent", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      const heights = makeHeights(["a", "b"]);
      engine.send({ type: "SET_HEIGHTS", heights });
      const snap1 = engine.getSnapshot();

      engine.send({ type: "SET_HEIGHTS", heights });
      const snap2 = engine.getSnapshot();
      expect(snap2).toBe(snap1);
    });

    it("simulates React effect cycle without infinite notify", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      let renderCount = 0;
      const MAX_RENDERS = 20;

      engine.subscribe(() => {
        renderCount++;
        if (renderCount > MAX_RENDERS) {
          throw new Error("Infinite render loop detected!");
        }
        engine.getSnapshot();
      });

      engine.send({ type: "SET_HEIGHTS", heights: makeHeights(["a", "b"]) });
      engine.send({
        type: "SET_CONTAINER",
        width: 800,
      });
      engine.send({ type: "SET_HEIGHTS", heights: makeHeights(["a", "b"]) });
      engine.send({
        type: "SET_CONTAINER",
        width: 800,
      });

      expect(renderCount).toBeLessThan(MAX_RENDERS);
    });
  });

  describe("layout uses state.maxColumns, not config", () => {
    it("setMaxColumns changes layout", () => {
      const engine = createTestEngine([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
        { id: "c", colSpan: 1, order: 2 },
      ]);

      engine.dispatch({ type: "SET_MAX_COLUMNS", maxColumns: 3 });

      const snap2 = engine.getSnapshot();
      const aPos2 = snap2.layout.positions.get("a")!;
      const bPos2 = snap2.layout.positions.get("b")!;
      const cPos2 = snap2.layout.positions.get("c")!;

      expect(aPos2.y).toBe(0);
      expect(bPos2.y).toBe(0);
      expect(cPos2.y).toBe(0);
    });

    it("setMaxColumns to 1 stacks all widgets vertically", () => {
      const engine = createTestEngine([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", colSpan: 1, order: 1 },
      ]);

      engine.dispatch({ type: "SET_MAX_COLUMNS", maxColumns: 1 });

      const snap = engine.getSnapshot();
      const aPos = snap.layout.positions.get("a")!;
      const bPos = snap.layout.positions.get("b")!;

      expect(bPos.y).toBeGreaterThan(aPos.y);
      expect(aPos.width).toBe(bPos.width);
    });
  });

  describe("dragged widget stays in layout", () => {
    it("layout includes the dragged widget during drag", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: 110, y: 50 },
        timestamp: 10,
      });
      expect(engine.getSnapshot().phase.type).toBe("dragging");

      const snap = engine.getSnapshot();
      expect(snap.layout.positions.has("a")).toBe(true);
      expect(snap.layout.positions.has("b")).toBe(true);
    });

    it("getDragPosition updates on every POINTER_MOVE without notify", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      const aPos = engine.getSnapshot().layout.positions.get("a")!;
      const startX = aPos.x + 20;
      const startY = aPos.y + 20;

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: startX, y: startY },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: startX + 10, y: startY },
        timestamp: 10,
      });
      expect(engine.getSnapshot().phase.type).toBe("dragging");

      engine.send({
        type: "POINTER_MOVE",
        position: { x: startX + 15, y: startY },
        timestamp: 15,
      });

      const listener = vi.fn();
      engine.subscribe(listener);

      engine.send({
        type: "POINTER_MOVE",
        position: { x: startX + 50, y: startY + 30 },
        timestamp: 20,
      });
      const pos1 = engine.getDragPosition();
      expect(pos1).not.toBeNull();

      engine.send({
        type: "POINTER_MOVE",
        position: { x: startX + 200, y: startY + 100 },
        timestamp: 30,
      });
      const pos2 = engine.getDragPosition();
      expect(pos2).not.toBeNull();

      expect(pos2!.x).not.toBe(pos1!.x);
      expect(pos2!.y).not.toBe(pos1!.y);

      expect(listener).not.toHaveBeenCalled();
    });

    it("dragPosition is computed from pointer minus grab offset", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      const aPos = engine.getSnapshot().layout.positions.get("a")!;

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: aPos.x + 20, y: aPos.y + 20 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: aPos.x + 30, y: aPos.y + 20 },
        timestamp: 10,
      });

      const snap = engine.getSnapshot();
      expect(snap.dragPosition).not.toBeNull();
      expect(snap.dragPosition!.x).toBeCloseTo(aPos.x + 10, 0);
      expect(snap.dragPosition!.y).toBeCloseTo(aPos.y, 0);
    });
  });

  describe("initialization", () => {
    it("starts in idle phase", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);
      const snap = engine.getSnapshot();
      expect(snap.phase.type).toBe("idle");
      expect(snap.intent).toBeNull();
      expect(snap.zone).toBeNull();
      expect(snap.dragPosition).toBeNull();
      expect(snap.previewLayout).toBeNull();
    });

    it("computes initial layout", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);
      const snap = engine.getSnapshot();
      expect(snap.layout.positions.size).toBe(2);
      expect(snap.layout.positions.has("a")).toBe(true);
      expect(snap.layout.positions.has("b")).toBe(true);
    });
  });

  describe("pointer drag lifecycle", () => {
    it("idle → pending → dragging → dropping → idle", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      expect(engine.getSnapshot().phase.type).toBe("pending");

      engine.send({
        type: "POINTER_MOVE",
        position: { x: 110, y: 50 },
        timestamp: 10,
      });
      expect(engine.getSnapshot().phase.type).toBe("dragging");

      const bPos = engine.getSnapshot().layout.positions.get("b");
      if (bPos) {
        engine.send({
          type: "POINTER_MOVE",
          position: { x: bPos.x + bPos.width / 2, y: bPos.y + bPos.height / 2 },
          timestamp: 100,
        });
        engine.send({
          type: "TICK",
          timestamp: 500,
        });
      }

      const snapDragging = engine.getSnapshot();
      expect(snapDragging.phase.type).toBe("dragging");

      engine.send({ type: "POINTER_UP", timestamp: 600 });
      const snapDropping = engine.getSnapshot();
      expect(
        snapDropping.phase.type === "dropping" ||
          snapDropping.phase.type === "idle"
      ).toBe(true);

      engine.send({ type: "TICK", timestamp: 1000 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("pending → idle on POINTER_UP without activation", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      expect(engine.getSnapshot().phase.type).toBe("pending");

      engine.send({ type: "POINTER_UP", timestamp: 10 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("pending → idle on POINTER_CANCEL", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({ type: "POINTER_CANCEL", timestamp: 5 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("dragging → idle on POINTER_UP without intent", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: 110, y: 50 },
        timestamp: 10,
      });
      expect(engine.getSnapshot().phase.type).toBe("dragging");

      engine.send({
        type: "POINTER_MOVE",
        position: { x: -100, y: -100 },
        timestamp: 20,
      });

      engine.send({ type: "POINTER_UP", timestamp: 30 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });
  });

  describe("touch activation", () => {
    it("activates after touch delay via TICK", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "touch",
      });
      expect(engine.getSnapshot().phase.type).toBe("pending");

      engine.send({ type: "TICK", timestamp: 100 });
      expect(engine.getSnapshot().phase.type).toBe("pending");

      engine.send({ type: "TICK", timestamp: 250 });
      expect(engine.getSnapshot().phase.type).toBe("dragging");
    });

    it("cancels touch drag if moved too far", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "touch",
      });

      engine.send({
        type: "POINTER_MOVE",
        position: { x: 100, y: 70 },
        timestamp: 50,
      });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });
  });

  describe("position-locked widget handling", () => {
    it("ignores POINTER_DOWN on position-locked widget", () => {
      const engine = createTestEngine(
        [{ id: "a", order: 0 }],
        { isPositionLocked: (id) => id === "a" }
      );

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("ignores KEY_PICKUP on position-locked widget", () => {
      const engine = createTestEngine(
        [{ id: "a", order: 0 }],
        { isPositionLocked: (id) => id === "a" }
      );

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("allows POINTER_DOWN when only resize-locked", () => {
      const engine = createTestEngine(
        [{ id: "a", order: 0 }],
        { isResizeLocked: (id) => id === "a" }
      );

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      expect(engine.getSnapshot().phase.type).toBe("pending");
    });
  });

  describe("resize-locked widget handling", () => {
    it("RESIZE_TOGGLE is blocked on resize-locked widget", () => {
      const engine = createTestEngine(
        [{ id: "a", colSpan: 1, order: 0 }],
        { isResizeLocked: (id) => id === "a" }
      );

      const stateBefore = engine.getState();
      engine.send({ type: "RESIZE_TOGGLE", id: "a", timestamp: 0 });
      expect(engine.getState()).toBe(stateBefore);
    });

    it("RESIZE_TOGGLE works when only position-locked", () => {
      const engine = createTestEngine(
        [{ id: "a", colSpan: 1, order: 0 }],
        { isPositionLocked: (id) => id === "a" }
      );

      engine.send({ type: "RESIZE_TOGGLE", id: "a", timestamp: 0 });
      expect(engine.getState().widgets[0].colSpan).toBe(2);
    });

    it("dispatch RESIZE_WIDGET is blocked on resize-locked widget", () => {
      const engine = createTestEngine(
        [{ id: "a", colSpan: 1, order: 0 }],
        { isResizeLocked: (id) => id === "a" }
      );

      engine.dispatch({ type: "RESIZE_WIDGET", id: "a", colSpan: 2 });
      expect(engine.getState().widgets[0].colSpan).toBe(1);
    });

    it("dispatch RESIZE_WIDGET works when only position-locked", () => {
      const engine = createTestEngine(
        [{ id: "a", colSpan: 1, order: 0 }],
        { isPositionLocked: (id) => id === "a" }
      );

      engine.dispatch({ type: "RESIZE_WIDGET", id: "a", colSpan: 2 });
      expect(engine.getState().widgets[0].colSpan).toBe(2);
    });
  });

  describe("keyboard drag", () => {
    it("complete keyboard flow: pickup → move → drop", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
        { id: "c", order: 2 },
      ]);

      const initialState = engine.getState();

      engine.send({ type: "KEY_PICKUP", id: "b", timestamp: 0 });
      const kbPhase = engine.getSnapshot().phase;
      expect(kbPhase.type).toBe("keyboard-dragging");
      if (kbPhase.type === "keyboard-dragging") {
        expect(kbPhase.sourceId).toBe("b");
        expect(kbPhase.currentIndex).toBe(1);
        expect(kbPhase.originalIndex).toBe(1);
      }

      engine.send({ type: "KEY_MOVE", direction: "down", timestamp: 100 });
      const movedPhase = engine.getSnapshot().phase;
      if (movedPhase.type === "keyboard-dragging") {
        expect(movedPhase.currentIndex).toBe(2);
      }

      engine.send({ type: "KEY_DROP", timestamp: 200 });
      expect(engine.getSnapshot().phase.type).toBe("idle");

      const newState = engine.getState();
      expect(newState).not.toBe(initialState);
    });

    it("keyboard cancel reverts state", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      const initialState = engine.getState();

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      engine.send({ type: "KEY_MOVE", direction: "down", timestamp: 100 });
      engine.send({ type: "KEY_CANCEL", timestamp: 200 });

      expect(engine.getSnapshot().phase.type).toBe("idle");
      expect(engine.getState()).toBe(initialState);
    });

    it("keyboard resize changes colSpan", () => {
      const engine = createTestEngine([
        { id: "a", colSpan: 1, order: 0 },
        { id: "b", order: 1 },
      ]);

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      engine.send({ type: "KEY_RESIZE", direction: "grow", timestamp: 100 });

      const phase = engine.getSnapshot().phase;
      if (phase.type === "keyboard-dragging") {
        expect(phase.currentColSpan).toBe(2);
      }

      engine.send({ type: "KEY_DROP", timestamp: 200 });

      const widget = engine.getState().widgets.find((w) => w.id === "a");
      expect(widget?.colSpan).toBe(2);
    });

    it("respects bounds on keyboard move", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });

      engine.send({ type: "KEY_MOVE", direction: "up", timestamp: 100 });
      const phase = engine.getSnapshot().phase;
      if (phase.type === "keyboard-dragging") {
        expect(phase.currentIndex).toBe(0);
      }
    });
  });

  describe("invalid transitions", () => {
    it("ignores POINTER_DOWN when not idle", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      expect(engine.getSnapshot().phase.type).toBe("pending");

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 200, y: 50 },
        timestamp: 5,
        pointerType: "mouse",
      });
      expect(engine.getSnapshot().phase.type).toBe("pending");
    });

    it("ignores KEY_PICKUP when not idle", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });

      engine.send({ type: "KEY_PICKUP", id: "b", timestamp: 5 });
      expect(engine.getSnapshot().phase.type).toBe("pending");
    });

    it("ignores KEY_MOVE when not keyboard-dragging", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({ type: "KEY_MOVE", direction: "down", timestamp: 0 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("RESIZE_TOGGLE only works in idle", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });

      const stateBefore = engine.getState();
      engine.send({ type: "RESIZE_TOGGLE", id: "a", timestamp: 5 });
      expect(engine.getState()).toBe(stateBefore);
    });
  });

  describe("CANCEL event", () => {
    it("cancels from pending", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({ type: "CANCEL", timestamp: 5 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("cancels from dragging", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: 110, y: 50 },
        timestamp: 10,
      });
      engine.send({ type: "CANCEL", timestamp: 20 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });

    it("cancels from keyboard-dragging and reverts", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);
      const initial = engine.getState();

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      engine.send({ type: "KEY_MOVE", direction: "down", timestamp: 100 });
      engine.send({ type: "CANCEL", timestamp: 200 });

      expect(engine.getSnapshot().phase.type).toBe("idle");
      expect(engine.getState()).toBe(initial);
    });

    it("no-op from idle", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      engine.send({ type: "CANCEL", timestamp: 0 });
      expect(engine.getSnapshot().phase.type).toBe("idle");
    });
  });

  describe("dispatch (non-drag state mutations)", () => {
    it("dispatches state actions", () => {
      const engine = createTestEngine([
        { id: "a", colSpan: 1, order: 0 },
      ]);

      engine.dispatch({ type: "RESIZE_WIDGET", id: "a", colSpan: 2 });
      const widget = engine.getState().widgets.find((w) => w.id === "a");
      expect(widget?.colSpan).toBe(2);
    });

    it("supports undo/redo", () => {
      const engine = createTestEngine([
        { id: "a", colSpan: 1, order: 0 },
      ]);

      engine.dispatch({ type: "RESIZE_WIDGET", id: "a", colSpan: 2 });
      expect(engine.getSnapshot().canUndo).toBe(true);

      engine.dispatch({ type: "UNDO" });
      expect(engine.getState().widgets[0].colSpan).toBe(1);
      expect(engine.getSnapshot().canRedo).toBe(true);

      engine.dispatch({ type: "REDO" });
      expect(engine.getState().widgets[0].colSpan).toBe(2);
    });
  });

  describe("subscribe/notify", () => {
    it("notifies listeners on send()", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies listeners on dispatch()", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.dispatch({ type: "RESIZE_WIDGET", id: "a", colSpan: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe stops notifications", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);

      unsub();
      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it("snapshot is cached between sends", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const snap1 = engine.getSnapshot();
      const snap2 = engine.getSnapshot();
      expect(snap1).toBe(snap2);
    });

    it("snapshot preserved when send() causes no change (no-op TICK in idle)", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const snap1 = engine.getSnapshot();

      engine.send({ type: "TICK", timestamp: 100 });
      const snap2 = engine.getSnapshot();
      expect(snap1).toBe(snap2);
    });

    it("snapshot changes when send() causes real state change", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);
      const snap1 = engine.getSnapshot();

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      const snap2 = engine.getSnapshot();
      expect(snap1).not.toBe(snap2);
    });
  });

  describe("dropping phase", () => {
    it("transitions dropping → idle after animation duration", () => {
      const engine = createTestEngine(
        [
          { id: "a", order: 0 },
          { id: "b", order: 1 },
        ],
        { dropAnimationDuration: 100 }
      );

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: 110, y: 50 },
        timestamp: 10,
      });

      const bPos = engine.getSnapshot().layout.positions.get("b");
      if (bPos) {
        engine.send({
          type: "POINTER_MOVE",
          position: { x: bPos.x + bPos.width + 10, y: bPos.y + bPos.height / 2 },
          timestamp: 20,
        });
      }

      engine.send({ type: "POINTER_UP", timestamp: 100 });

      if (engine.getSnapshot().phase.type === "dropping") {
        engine.send({ type: "TICK", timestamp: 150 });
        expect(engine.getSnapshot().phase.type).toBe("dropping");

        engine.send({ type: "TICK", timestamp: 250 });
        expect(engine.getSnapshot().phase.type).toBe("idle");
      }
    });
  });

  describe("RESIZE_TOGGLE", () => {
    it("toggles colSpan between 1 and maxColumns", () => {
      const engine = createTestEngine([
        { id: "a", colSpan: 1, order: 0 },
      ]);

      engine.send({ type: "RESIZE_TOGGLE", id: "a", timestamp: 0 });
      expect(engine.getState().widgets[0].colSpan).toBe(2);

      engine.send({ type: "RESIZE_TOGGLE", id: "a", timestamp: 100 });
      expect(engine.getState().widgets[0].colSpan).toBe(1);
    });

    it("is undoable", () => {
      const engine = createTestEngine([
        { id: "a", colSpan: 1, order: 0 },
      ]);

      engine.send({ type: "RESIZE_TOGGLE", id: "a", timestamp: 0 });
      expect(engine.getState().widgets[0].colSpan).toBe(2);

      engine.dispatch({ type: "UNDO" });
      expect(engine.getState().widgets[0].colSpan).toBe(1);
    });
  });

  describe("announcements", () => {
    it("announces drag start", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({
        type: "POINTER_MOVE",
        position: { x: 110, y: 50 },
        timestamp: 10,
      });

      expect(engine.getSnapshot().announcement).toBe("Dragging started");
    });

    it("announces keyboard pickup", () => {
      const engine = createTestEngine([
        { id: "a", order: 0 },
        { id: "b", order: 1 },
      ]);

      engine.send({ type: "KEY_PICKUP", id: "a", timestamp: 0 });
      expect(engine.getSnapshot().announcement).toContain("Picked up");
    });

    it("announces cancel", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.send({
        type: "POINTER_DOWN",
        id: "a",
        position: { x: 100, y: 50 },
        timestamp: 0,
        pointerType: "mouse",
      });
      engine.send({ type: "POINTER_CANCEL", timestamp: 5 });
      expect(engine.getSnapshot().announcement).toBe("Drag cancelled");
    });
  });

  describe("config updates", () => {
    it("updateConfig changes behavior", () => {
      const engine = createTestEngine([{ id: "a", order: 0 }]);

      engine.updateConfig({ maxColumns: 4 });

      const snap = engine.getSnapshot();
      expect(snap.layout.positions.size).toBeGreaterThan(0);
    });
  });
});
