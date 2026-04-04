/**
 * The three dimensions along which a widget can be locked.
 *
 * - `"position"` — prevents dragging / reordering
 * - `"resize"` — prevents column-span changes
 * - `"remove"` — prevents deletion
 */
export type LockType = "position" | "resize" | "remove";

/**
 * Describes a category of widget available in the dashboard.
 *
 * Definitions act as a catalog — they are immutable at runtime and shared
 * across all instances of that widget type.
 */
export interface WidgetDefinition {
  /** Unique identifier for this widget type (e.g. `"chart"`). */
  type: string;
  /** Human-readable display name shown in catalogs and accessibility labels. */
  label: string;
  /** Column span assigned to new instances of this type. */
  defaultColSpan: number;
  /** Minimum allowed column span. The resize action clamps to this value. */
  minColSpan?: number;
  /** Maximum allowed column span. The resize action clamps to this value. */
  maxColSpan?: number;
  /** When `true`, all instances of this type are locked from being dragged by default. Overridable per-instance via {@link WidgetState.lockPosition}. */
  lockPosition?: boolean;
  /** When `true`, all instances of this type are locked from being resized by default. Overridable per-instance via {@link WidgetState.lockResize}. */
  lockResize?: boolean;
  /** When `true`, all instances of this type are locked from being removed by default. Overridable per-instance via {@link WidgetState.lockRemove}. */
  lockRemove?: boolean;
}

/**
 * Runtime state of a single widget instance on the dashboard.
 *
 * Widget state is mutable through {@link DashboardActions}.
 */
export interface WidgetState {
  /** Unique instance identifier (typically a UUID). */
  id: string;
  /** References a {@link WidgetDefinition.type}. */
  type: string;
  /** Current width in grid columns. Clamped to `[1, maxColumns]`. */
  colSpan: number;
  /** Whether the widget is visible on the grid. */
  visible: boolean;
  /** Sort order — lower values appear first in the layout. */
  order: number;
  /** Column hint that forces the widget to start at a specific column. Set by column-shift drags; cleared on reorder. */
  columnStart?: number;
  /** Arbitrary per-widget configuration object. Use {@link DashboardActions.updateWidgetConfig} to modify. */
  config?: Record<string, unknown>;
  /** Per-instance override for position locking. Takes precedence over the definition's `lockPosition`. */
  lockPosition?: boolean;
  /** Per-instance override for resize locking. Takes precedence over the definition's `lockResize`. */
  lockResize?: boolean;
  /** Per-instance override for remove locking. Takes precedence over the definition's `lockRemove`. */
  lockRemove?: boolean;
}
