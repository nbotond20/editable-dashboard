import { useState } from "react";
import { DragEngine } from "../engine/drag-engine.ts";
import type { DragEngineConfig } from "../engine/types.ts";
import type { DashboardState, WidgetDefinition } from "../types.ts";
import { isLockActive } from "../locks.ts";

export function useDragEngine(
  state: DashboardState,
  definitions: WidgetDefinition[],
  config: Partial<DragEngineConfig>,
): DragEngine {
  const [engine] = useState(() =>
    new DragEngine(state, {
      ...config,
      isPositionLocked: (id) => isLockActive(id, "position", state, definitions),
      isResizeLocked: (id) => isLockActive(id, "resize", state, definitions),
      getWidgetConstraints: buildGetConstraints(config.getWidgetConstraints),
    }),
  );

  engine.updateConfig({
    ...config,
    isPositionLocked: (id) => isLockActive(id, "position", engine.getState(), definitions),
    isResizeLocked: (id) => isLockActive(id, "resize", engine.getState(), definitions),
    getWidgetConstraints: buildGetConstraints(config.getWidgetConstraints),
  });

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
