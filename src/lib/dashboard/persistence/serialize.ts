import type {
  DashboardState,
  SerializedDashboard,
  WidgetDefinition,
  WidgetState,
} from "../types.ts";

const CURRENT_VERSION = 2;

export function serializeDashboard(
  state: DashboardState
): SerializedDashboard {
  return {
    version: CURRENT_VERSION,
    widgets: state.widgets.map((w) => ({ ...w })),
    maxColumns: state.maxColumns,
    gap: state.gap,
  };
}

export function deserializeDashboard(
  data: SerializedDashboard,
  definitions: WidgetDefinition[]
): DashboardState {
  if (data.version !== 1 && data.version !== CURRENT_VERSION) {
    throw new Error(
      `Unsupported serialized dashboard version: ${data.version} (expected ${CURRENT_VERSION})`
    );
  }

  const knownTypes = new Set(definitions.map((d) => d.type));

  const widgets: WidgetState[] = data.widgets
    .filter((w) => knownTypes.has(w.type))
    .map((w) => {
      const base: WidgetState = {
        id: w.id,
        type: w.type,
        colSpan: Math.max(1, w.colSpan),
        visible: w.visible ?? true,
        order: w.order ?? 0,
        ...(w.columnStart !== undefined ? { columnStart: w.columnStart } : {}),
        ...(w.config !== undefined ? { config: w.config } : {}),
      };

      if (data.version === 1) {
        if ((w as Record<string, unknown>).locked) base.lockPosition = true;
      } else {
        if (w.lockPosition) base.lockPosition = true;
        if (w.lockResize) base.lockResize = true;
        if (w.lockRemove) base.lockRemove = true;
      }

      return base;
    });

  return {
    widgets,
    maxColumns: data.maxColumns,
    gap: data.gap,
    containerWidth: 0,
  };
}
