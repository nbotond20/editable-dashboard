import type { LockType, WidgetState } from "./widget.ts";

/**
 * The externally-facing dashboard state for controlled mode.
 *
 * Pass this to `<DashboardProvider state={…}>`. Layout configuration
 * (`maxColumns`, `gap`) is provided via top-level provider props, not here.
 */
export interface DashboardStateInput {
  /** All widget instances (visible and hidden). */
  widgets: WidgetState[];
}

/**
 * Complete internal state of the dashboard.
 *
 * Adds layout configuration and transient fields to the external
 * {@link DashboardStateInput}.
 */
export interface DashboardState {
  /** All widget instances (visible and hidden). */
  widgets: WidgetState[];
  /** Current number of grid columns. */
  maxColumns: number;
  /** Gap between widgets in pixels. */
  gap: number;
  /**
   * Measured container width in pixels.
   *
   * Transient — not serialized, defaults to 0 before first measurement.
   * @readonly
   */
  containerWidth: number;
}

/**
 * Discriminated union of all state reducer actions.
 */
export type DashboardAction =
  | { type: "ADD_WIDGET"; widgetType: string; colSpan: number; config?: Record<string, unknown> }
  | { type: "REMOVE_WIDGET"; id: string }
  | { type: "RESIZE_WIDGET"; id: string; colSpan: number }
  | { type: "REORDER_WIDGETS"; fromIndex: number; toIndex: number }
  | { type: "SET_MAX_COLUMNS"; maxColumns: number }
  | { type: "BATCH_UPDATE"; widgets: WidgetState[] }
  | { type: "UPDATE_WIDGET_CONFIG"; id: string; config: Record<string, unknown> }
  | { type: "SWAP_WIDGETS"; sourceId: string; targetId: string }
  | { type: "SET_WIDGET_LOCK"; id: string; lockType: LockType; locked: boolean }
  | { type: "SHOW_WIDGET"; id: string }
  | { type: "HIDE_WIDGET"; id: string }
  | { type: "UNDO" }
  | { type: "REDO" };

/**
 * Stable, memoized action dispatchers returned by {@link useDashboard}.
 */
export interface DashboardActions {
  addWidget: (widgetType: string, colSpan?: number, config?: Record<string, unknown>) => void;
  removeWidget: (id: string) => void;
  resizeWidget: (id: string, colSpan: number) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  setMaxColumns: (maxColumns: number) => void;
  batchUpdate: (widgets: WidgetState[]) => void;
  updateWidgetConfig: (id: string, config: Record<string, unknown>) => void;
  showWidget: (id: string) => void;
  hideWidget: (id: string) => void;
  setWidgetLock: (id: string, lockType: LockType, locked: boolean) => void;
  undo: () => void;
  redo: () => void;
}
