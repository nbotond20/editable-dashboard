import { useContext } from "react";
import { DashboardDragContext } from "../state/use-dashboard.ts";
import type { EmptySlotDragState } from "../types.ts";

/**
 * Returns live drop feedback for the empty slot a dragged widget is currently over.
 *
 * Populated only during a `"lines"`-mode pointer drag while the dragged widget is
 * over a row's trailing free space (an {@link useEmptySlots} region). `null` otherwise.
 * Use it to recolor the matching slot — `"valid"` (the widget fits) or `"invalid"`
 * (with a `reason`) — instead of, or in addition to, the standalone drop affordances.
 */
export function useEmptySlotDragState(): EmptySlotDragState | null {
  const ctx = useContext(DashboardDragContext);
  if (!ctx) return null;
  return ctx.dragState.emptySlotDragState;
}
