import type {
  DashboardState,
  SerializedDashboard,
  WidgetDefinition,
  WidgetState,
} from "../types.ts";

const CURRENT_VERSION = 2;

/**
 * Convert a {@link DashboardState} into a JSON-serializable snapshot.
 *
 * Strips the transient `containerWidth` field and stamps the current schema version.
 * The result can be stored in localStorage, a database, or sent over the network.
 *
 * @param state - The dashboard state to serialize.
 * @returns A {@link SerializedDashboard} safe for `JSON.stringify`.
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
 * Restore a {@link DashboardState} from a serialized snapshot.
 *
 * - Widgets whose `type` has no matching definition are silently dropped.
 * - Supports schema version 1 (migrates `locked` → `lockPosition`) and version 2.
 * - Throws if the `version` field is unsupported.
 *
 * @param data - A previously serialized dashboard snapshot.
 * @param definitions - Current widget definitions to validate against.
 * @returns A fully hydrated {@link DashboardState} with `containerWidth` set to 0.
 * @throws {Error} If `data.version` is neither 1 nor 2.
 */
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
        if ("locked" in w && w.locked) base.lockPosition = true;
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
