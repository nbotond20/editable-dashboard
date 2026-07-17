import { useMemo } from "react";
import { useDashboardStable, useDashboardDrag } from "../state/use-dashboard.ts";
import { computeEmptySlots } from "../layout/compute-empty-slots.ts";
import type { EmptySlot } from "../types.ts";

/**
 * Returns the regions of free column space where a new widget could be added.
 *
 * Covers trailing free columns in partially-filled rows and, when the dashboard
 * is empty, a single full-width slot. Coordinates are in pixels relative to the
 * grid container's top-left corner.
 *
 * During a drag the slots are computed from the live preview layout (with the
 * drop placeholder counted as occupied), so they reflow — shrink, grow and
 * shift — alongside the widgets and never overlap the reflowed layout. When no
 * drag is active, they reflect the committed layout.
 */
export function useEmptySlots(): EmptySlot[] {
  const { state, layout, containerWidth } = useDashboardStable();
  const { dragState } = useDashboardDrag();
  const { maxColumns, gap, widgets } = state;

  const activeLayout = dragState.previewLayout ?? layout;

  return useMemo(
    () => computeEmptySlots(activeLayout, widgets, maxColumns, gap, containerWidth),
    [widgets, activeLayout, maxColumns, gap, containerWidth],
  );
}
