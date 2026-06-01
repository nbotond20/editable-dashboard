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
  const maxColumns = config.maxColumns ?? state.maxColumns;

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
      getWidgetConstraints: buildGetConstraints(
        (id) => state.widgets.find((w) => w.id === id),
        definitions,
        maxColumns,
        config.getWidgetConstraints,
      ),
    }),
  );

  engine.updateConfig({
    ...config,
    isPositionLocked: lockCheck(engine, definitions, "position"),
    isResizeLocked: lockCheck(engine, definitions, "resize"),
    getWidgetConstraints: buildGetConstraints(
      (id) => engine.getWidgetById(id),
      definitions,
      maxColumns,
      config.getWidgetConstraints,
    ),
  });

  useLayoutEffect(() => {
    if (isControlled) {
      engine.replaceState(state);
    }
  }, [isControlled, engine, state]);

  return engine;
}

function buildGetConstraints(
  getWidget: (id: string) => { type: string } | undefined,
  definitions: WidgetDefinition[],
  maxColumns: number,
  custom?: (id: string) => { minSpan: number; maxSpan: number },
): (id: string) => { minSpan: number; maxSpan: number } {
  return (id: string) => {
    if (custom) return custom(id);
    const widget = getWidget(id);
    const def = widget ? definitions.find((d) => d.type === widget.type) : undefined;
    const minSpan = Math.max(1, def?.minColSpan ?? 1);
    const maxSpan = Math.min(def?.maxColSpan ?? maxColumns, maxColumns);
    return { minSpan, maxSpan: Math.max(minSpan, maxSpan) };
  };
}
