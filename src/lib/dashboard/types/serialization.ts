import type { WidgetState } from "./widget.ts";

/**
 * JSON-serializable snapshot of a dashboard.
 */
export interface SerializedDashboard {
  version: number;
  widgets: WidgetState[];
  maxColumns: number;
  gap: number;
}
