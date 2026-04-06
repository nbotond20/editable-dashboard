import { useState, useLayoutEffect } from "react";
import { DragEngine } from "../engine/drag-engine.ts";
import type { DragEngineConfig } from "../engine/types.ts";
import type { DashboardState, WidgetDefinition } from "../types.ts";
import { isLockActiveForWidget } from "../locks.ts";

function lockCheck(engine: DragEngine, definitions: WidgetDefinition[], lockType: "position" | "resize") {
  return (id: string) => {
    const widget = engine.getWidgetById(id);
    return widget ? isLockActiveForWidget(widget, lockType, definitions) : false;
  };
}

export function useDragEngine(
  state: DashboardState,
  definitions: WidgetDefinition[],
  config: Partial<DragEngineConfig>,
  isControlled: boolean,
): DragEngine {
  const [engine] = useState(() =>
    new DragEngine(state, {
      ...config,
      isPositionLocked: (id) => {
        const widget = state.widgets.find((w) => w.id === id);
        return widget ? isLockActiveForWidget(widget, "position", definitions) : false;
      },
      isResizeLocked: (id) => {
        const widget = state.widgets.find((w) => w.id === id);
        return widget ? isLockActiveForWidget(widget, "resize", definitions) : false;
      },
      getWidgetConstraints: buildGetConstraints(config.getWidgetConstraints),
    }),
  );

  engine.updateConfig({
    ...config,
    isPositionLocked: lockCheck(engine, definitions, "position"),
    isResizeLocked: lockCheck(engine, definitions, "resize"),
    getWidgetConstraints: buildGetConstraints(config.getWidgetConstraints),
  });

  useLayoutEffect(() => {
    if (isControlled) {
      engine.replaceState(state);
    }
  }, [isControlled, engine, state]);

  return engine;
}

function buildGetConstraints(
  custom?: (id: string) => { minSpan: number; maxSpan: number },
): (id: string) => { minSpan: number; maxSpan: number } {
  return (id: string) => {
    if (custom) return custom(id);
    return { minSpan: 1, maxSpan: Infinity };
  };
}
