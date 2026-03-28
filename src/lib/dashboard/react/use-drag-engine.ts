import { useState } from "react";
import { DragEngine } from "../engine/drag-engine.ts";
import type { DragEngineConfig } from "../engine/types.ts";
import type { DashboardState, WidgetDefinition } from "../types.ts";

export function useDragEngine(
  state: DashboardState,
  definitions: WidgetDefinition[],
  config: Partial<DragEngineConfig>,
): DragEngine {
  const [engine] = useState(() =>
    new DragEngine(state, {
      ...config,
      isLocked: buildIsLocked(state, definitions, config.isLocked),
      getWidgetConstraints: buildGetConstraints(definitions, config.getWidgetConstraints),
    }),
  );

  engine.updateConfig({
    ...config,
    isLocked: buildIsLocked(engine.getState(), definitions, config.isLocked),
    getWidgetConstraints: buildGetConstraints(definitions, config.getWidgetConstraints),
  });

  return engine;
}

function buildIsLocked(
  state: DashboardState,
  definitions: WidgetDefinition[],
  custom?: (id: string) => boolean,
): (id: string) => boolean {
  return (id: string) => {
    if (custom?.(id)) return true;
    const widget = state.widgets.find((w) => w.id === id);
    if (!widget) return false;
    if (widget.locked) return true;
    const def = definitions.find((d) => d.type === widget.type);
    return def?.locked ?? false;
  };
}

function buildGetConstraints(
  definitions: WidgetDefinition[],
  custom?: (id: string) => { minSpan: number; maxSpan: number },
): (id: string) => { minSpan: number; maxSpan: number } {
  return (id: string) => {
    if (custom) return custom(id);
    return { minSpan: 1, maxSpan: Infinity };
  };
}
