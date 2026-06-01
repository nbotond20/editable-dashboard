import { useContext } from "react";
import { DashboardDragContext } from "../state/use-dashboard.ts";
import type { InvalidDropTarget } from "../types.ts";

/**
 * Returns the footprint and reason for an infeasible drop at the hovered location.
 *
 * Populated only during a `"lines"`-mode pointer drag while the pointer is over a
 * location the dragged widget cannot fit — the headless anchor for rendering a
 * "cannot fit" affordance. `null` whenever the current location is a valid drop target.
 */
export function useInvalidTarget(): InvalidDropTarget | null {
  const ctx = useContext(DashboardDragContext);
  if (!ctx) return null;
  return ctx.dragState.invalidTarget;
}
