import type {
  DashboardState,
  SerializedDashboard,
  WidgetDefinition,
  WidgetState,
} from "../types.ts";

/**
 * Current serialization schema version.
 *
 * **Version history:**
 * - **v1** -- Initial format. Widgets used a single `locked` boolean field
 *   that mapped to position locking only.
 * - **v2** -- Replaced `locked` with three granular lock fields:
 *   `lockPosition`, `lockResize`, and `lockRemove`. Migration from v1 is
 *   lossless: `locked: true` becomes `lockPosition: true`.
 */
export const CURRENT_SERIALIZATION_VERSION = 2;

/**
 * Validate that `data` is a structurally valid {@link SerializedDashboard}.
 *
 * Use this to guard untrusted input (e.g. from localStorage or a network
 * response) before passing it to {@link deserializeDashboard}.
 *
 * @param data - Any value to check.
 * @returns An object with `valid: true` when the data is acceptable, or
 *   `valid: false` together with a list of human-readable `errors`.
 */
export function validateSerializedDashboard(
  data: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Input must be a non-null object"] };
  }

  const obj = data as Record<string, unknown>;

  if (!("version" in obj) || typeof obj.version !== "number") {
    errors.push("Missing or invalid field: version (expected a number)");
  } else if (obj.version !== 1 && obj.version !== 2) {
    errors.push(
      `Unsupported version: ${obj.version} (supported: 1, 2)`
    );
  }

  if (!("maxColumns" in obj) || typeof obj.maxColumns !== "number") {
    errors.push("Missing or invalid field: maxColumns (expected a number)");
  }

  if (!("gap" in obj) || typeof obj.gap !== "number") {
    errors.push("Missing or invalid field: gap (expected a number)");
  }

  if (!("widgets" in obj) || !Array.isArray(obj.widgets)) {
    errors.push("Missing or invalid field: widgets (expected an array)");
    return { valid: false, errors };
  }

  const widgets = obj.widgets as unknown[];
  for (let i = 0; i < widgets.length; i++) {
    const w = widgets[i];
    const prefix = `widgets[${i}]`;

    if (w === null || typeof w !== "object" || Array.isArray(w)) {
      errors.push(`${prefix}: must be a non-null object`);
      continue;
    }

    const wObj = w as Record<string, unknown>;

    if (typeof wObj.id !== "string" || wObj.id === "") {
      errors.push(`${prefix}.id: must be a non-empty string`);
    }

    if (typeof wObj.type !== "string" || wObj.type === "") {
      errors.push(`${prefix}.type: must be a non-empty string`);
    }

    if (typeof wObj.colSpan !== "number") {
      errors.push(`${prefix}.colSpan: must be a number`);
    }

    if (typeof wObj.visible !== "boolean" && wObj.visible !== undefined) {
      errors.push(`${prefix}.visible: must be a boolean if present`);
    }

    if (typeof wObj.order !== "number" && wObj.order !== undefined) {
      errors.push(`${prefix}.order: must be a number if present`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Convert a {@link DashboardState} into a JSON-serializable snapshot.
 *
 * - Strips the transient `containerWidth` field.
 * - Omits optional widget fields that hold their default value (e.g.
 *   `lockPosition: false`, `lockResize: false`, `lockRemove: false`) to keep
 *   the payload compact.
 * - Stamps the current schema version ({@link CURRENT_SERIALIZATION_VERSION}).
 *
 * The result can be stored in localStorage, a database, or sent over the network.
 *
 * @param state - The dashboard state to serialize.
 * @returns A {@link SerializedDashboard} safe for `JSON.stringify`.
 */
export function serializeDashboard(
  state: DashboardState
): SerializedDashboard {
  return {
    version: CURRENT_SERIALIZATION_VERSION,
    widgets: state.widgets.map((w) => {
      const out: WidgetState = {
        id: w.id,
        type: w.type,
        colSpan: w.colSpan,
        visible: w.visible,
        order: w.order,
      };
      if (w.columnStart !== undefined) out.columnStart = w.columnStart;
      if (w.config !== undefined) out.config = w.config;
      if (w.lockPosition) out.lockPosition = true;
      if (w.lockResize) out.lockResize = true;
      if (w.lockRemove) out.lockRemove = true;
      return out;
    }),
    maxColumns: state.maxColumns,
    gap: state.gap,
  };
}

/**
 * Restore a {@link DashboardState} from a serialized snapshot.
 *
 * - Validates all required fields and throws descriptive errors for invalid input.
 * - Widgets whose `type` has no matching definition are silently dropped.
 * - Duplicate widget IDs are deduplicated (first occurrence wins).
 * - `colSpan` values are clamped to `[1, maxColumns]`.
 * - Supports schema version 1 (migrates `locked` -> `lockPosition`) and version 2.
 * - Extra/unknown fields in the serialized data are ignored (forward compatibility).
 *
 * @param data - A previously serialized dashboard snapshot.
 * @param definitions - Current widget definitions to validate against.
 * @returns A fully hydrated {@link DashboardState} with `containerWidth` set to 0.
 * @throws {Error} If `data` is not a valid serialized dashboard.
 */
export function deserializeDashboard(
  data: SerializedDashboard,
  definitions: WidgetDefinition[]
): DashboardState {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("deserializeDashboard: input must be a non-null object");
  }

  if (typeof data.version !== "number") {
    throw new Error(
      "deserializeDashboard: missing or invalid 'version' field (expected a number)"
    );
  }

  if (data.version !== 1 && data.version !== CURRENT_SERIALIZATION_VERSION) {
    throw new Error(
      `Unsupported serialized dashboard version: ${data.version} (expected ${CURRENT_SERIALIZATION_VERSION})`
    );
  }

  if (!Array.isArray(data.widgets)) {
    throw new Error(
      "deserializeDashboard: 'widgets' must be an array"
    );
  }

  if (typeof data.maxColumns !== "number") {
    throw new Error(
      "deserializeDashboard: missing or invalid 'maxColumns' field (expected a number)"
    );
  }

  if (typeof data.gap !== "number") {
    throw new Error(
      "deserializeDashboard: missing or invalid 'gap' field (expected a number)"
    );
  }

  for (let i = 0; i < data.widgets.length; i++) {
    const w = data.widgets[i];
    if (w === null || typeof w !== "object" || Array.isArray(w)) {
      throw new Error(
        `deserializeDashboard: widgets[${i}] must be a non-null object`
      );
    }
    if (typeof w.id !== "string" || w.id === "") {
      throw new Error(
        `deserializeDashboard: widgets[${i}].id must be a non-empty string`
      );
    }
    if (typeof w.type !== "string" || w.type === "") {
      throw new Error(
        `deserializeDashboard: widgets[${i}].type must be a non-empty string`
      );
    }
    if (typeof w.colSpan !== "number") {
      throw new Error(
        `deserializeDashboard: widgets[${i}].colSpan must be a number`
      );
    }
    if (w.order !== undefined && typeof w.order !== "number") {
      throw new Error(
        `deserializeDashboard: widgets[${i}].order must be a number if present`
      );
    }
  }

  const knownTypes = new Set(definitions.map((d) => d.type));
  const maxCols = data.maxColumns;
  const seenIds = new Set<string>();

  const widgets: WidgetState[] = data.widgets
    .filter((w) => {
      if (!knownTypes.has(w.type)) return false;
      if (seenIds.has(w.id)) return false;
      seenIds.add(w.id);
      return true;
    })
    .map((w) => {
      const clampedColSpan = Math.min(Math.max(1, w.colSpan), maxCols);

      const base: WidgetState = {
        id: w.id,
        type: w.type,
        colSpan: clampedColSpan,
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
    maxColumns: maxCols,
    gap: data.gap,
    containerWidth: 0,
  };
}
