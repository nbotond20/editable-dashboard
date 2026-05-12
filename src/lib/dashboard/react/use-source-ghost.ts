import { useContext } from "react";
import { DashboardDragContext } from "../state/use-dashboard.ts";
import type { WidgetLayout } from "../types.ts";

/**
 * Returns the layout of the dragged widget at its original (pre-drag) slot.
 *
 * Populated only during a pointer drag while `dropMode` is `"lines"` or `"both"` —
 * the headless anchor for rendering a "source ghost" placeholder. `null` otherwise.
 */
export function useSourceGhost(): WidgetLayout | null {
  const ctx = useContext(DashboardDragContext);
  if (!ctx) return null;
  return ctx.dragState.sourceGhost;
}
