import type {
  DashboardState,
  SerializedDashboard,
  WidgetDefinition,
  WidgetState,
} from "../types.ts";

const CURRENT_VERSION = 1;

/**
 * Produces a JSON-safe snapshot of the dashboard state,
 * stripping transient fields like `containerWidth`.
 */
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

/**
 * Validates and rebuilds DashboardState from a serialized snapshot.
 * Widgets whose `type` has no matching definition are silently dropped.
 */
export function deserializeDashboard(
  data: SerializedDashboard,
  definitions: WidgetDefinition[]
): DashboardState {
  if (data.version !== CURRENT_VERSION) {
    throw new Error(
      `Unsupported serialized dashboard version: ${data.version} (expected ${CURRENT_VERSION})`
    );
  }

  const knownTypes = new Set(definitions.map((d) => d.type));

  const widgets: WidgetState[] = data.widgets
    .filter((w) => knownTypes.has(w.type))
    .map((w) => ({
      id: w.id,
      type: w.type,
      colSpan: Math.max(1, w.colSpan),
      visible: w.visible ?? true,
      order: w.order ?? 0,
      ...(w.columnStart !== undefined ? { columnStart: w.columnStart } : {}),
      ...(w.config !== undefined ? { config: w.config } : {}),
    }));

  return {
    widgets,
    maxColumns: data.maxColumns,
    gap: data.gap,
    containerWidth: 0,
  };
}
