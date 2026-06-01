import { useMemo } from "react";
import { useDashboardStable } from "../state/use-dashboard.ts";
import { computeEmptySlots } from "../layout/compute-empty-slots.ts";
import type { EmptySlot } from "../types.ts";

/**
 * Returns the regions of free column space where a new widget could be added.
 *
 * Covers trailing free columns in partially-filled rows and, when the dashboard
 * is empty, a single full-width slot. Coordinates are in pixels relative to the
 * grid container's top-left corner. Independent of drag state — render these as a
 * persistent "add widget" affordance (e.g. gated behind an editing mode).
 */
export function useEmptySlots(): EmptySlot[] {
  const { state, layout, containerWidth } = useDashboardStable();
  const { maxColumns, gap, widgets } = state;

  return useMemo(
    () => computeEmptySlots(layout, widgets, maxColumns, gap, containerWidth),
    [widgets, layout, maxColumns, gap, containerWidth],
  );
}
