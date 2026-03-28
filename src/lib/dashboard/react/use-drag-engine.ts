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
      isPositionLocked: buildIsPositionLocked(state, definitions),
      isResizeLocked: buildIsResizeLocked(state, definitions),
      getWidgetConstraints: buildGetConstraints(config.getWidgetConstraints),
    }),
  );

  engine.updateConfig({
    ...config,
    isPositionLocked: buildIsPositionLocked(engine.getState(), definitions),
    isResizeLocked: buildIsResizeLocked(engine.getState(), definitions),
    getWidgetConstraints: buildGetConstraints(config.getWidgetConstraints),
  });

  return engine;
}

function buildIsPositionLocked(
  state: DashboardState,
  definitions: WidgetDefinition[],
): (id: string) => boolean {
  return (id: string) => {
    const widget = state.widgets.find((w) => w.id === id);
    if (!widget) return false;
    if (widget.lockPosition != null) return widget.lockPosition;
    const def = definitions.find((d) => d.type === widget.type);
    return def?.lockPosition ?? false;
  };
}

function buildIsResizeLocked(
  state: DashboardState,
  definitions: WidgetDefinition[],
): (id: string) => boolean {
  return (id: string) => {
    const widget = state.widgets.find((w) => w.id === id);
    if (!widget) return false;
    if (widget.lockResize != null) return widget.lockResize;
    const def = definitions.find((d) => d.type === widget.type);
    return def?.lockResize ?? false;
  };
}

function buildGetConstraints(
  custom?: (id: string) => { minSpan: number; maxSpan: number },
): (id: string) => { minSpan: number; maxSpan: number } {
  return (id: string) => {
    if (custom) return custom(id);
    return { minSpan: 1, maxSpan: Infinity };
  };
}
