import type { DashboardError, WidgetDefinition, WidgetState } from "./types.ts";

/**
 * Create a {@link DashboardError} and emit a `console.warn` in development.
 */
export function createDashboardError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
): DashboardError {
  const error: DashboardError = { code, message, ...(context != null ? { context } : {}) };

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[editable-dashboard] ${code}: ${message}`, context ?? "");
  }

  return error;
}

/**
 * Validate the `definitions` array passed to `<DashboardProvider>`.
 *
 * Returns an array of errors (empty when valid).
 */
export function validateDefinitions(definitions: WidgetDefinition[]): DashboardError[] {
  const errors: DashboardError[] = [];

  if (!Array.isArray(definitions) || definitions.length === 0) {
    errors.push(
      createDashboardError(
        "INVALID_DEFINITIONS",
        "definitions must be a non-empty array",
      ),
    );
    return errors;
  }

  const seenTypes = new Set<string>();
  for (const def of definitions) {
    if (seenTypes.has(def.type)) {
      errors.push(
        createDashboardError(
          "DUPLICATE_DEFINITION_TYPE",
          `Duplicate widget definition type: "${def.type}"`,
          { type: def.type },
        ),
      );
    }
    seenTypes.add(def.type);

    if (def.defaultColSpan < 1) {
      errors.push(
        createDashboardError(
          "INVALID_DEFAULT_COL_SPAN",
          `Definition "${def.type}" has defaultColSpan ${def.defaultColSpan}, must be >= 1`,
          { type: def.type, defaultColSpan: def.defaultColSpan },
        ),
      );
    }
  }

  return errors;
}

/**
 * Validate provider-level numeric props.
 */
export function validateProviderProps(props: {
  maxColumns: number;
  gap: number;
  maxUndoDepth?: number;
}): DashboardError[] {
  const errors: DashboardError[] = [];

  if (props.maxColumns < 1) {
    errors.push(
      createDashboardError(
        "INVALID_MAX_COLUMNS",
        `maxColumns must be > 0, received ${props.maxColumns}`,
        { maxColumns: props.maxColumns },
      ),
    );
  }

  if (props.gap < 0) {
    errors.push(
      createDashboardError(
        "INVALID_GAP",
        `gap must be >= 0, received ${props.gap}`,
        { gap: props.gap },
      ),
    );
  }

  if (props.maxUndoDepth != null && props.maxUndoDepth < 1) {
    errors.push(
      createDashboardError(
        "INVALID_MAX_UNDO_DEPTH",
        `maxUndoDepth must be > 0, received ${props.maxUndoDepth}`,
        { maxUndoDepth: props.maxUndoDepth },
      ),
    );
  }

  return errors;
}

/**
 * Validate that `initialWidgets` only reference known definition types.
 *
 * Returns valid widgets (with invalid types filtered out) and any errors.
 */
export function validateInitialWidgets(
  widgets: WidgetState[],
  definitions: WidgetDefinition[],
): { validWidgets: WidgetState[]; errors: DashboardError[] } {
  const errors: DashboardError[] = [];
  const knownTypes = new Set(definitions.map((d) => d.type));
  const validWidgets: WidgetState[] = [];

  for (const widget of widgets) {
    if (!knownTypes.has(widget.type)) {
      errors.push(
        createDashboardError(
          "INVALID_WIDGET_TYPE",
          `Widget "${widget.id}" references unknown type "${widget.type}", skipping`,
          { widgetId: widget.id, widgetType: widget.type },
        ),
      );
    } else {
      validWidgets.push(widget);
    }
  }

  return { validWidgets, errors };
}
