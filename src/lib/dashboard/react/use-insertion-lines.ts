import { useContext } from "react";
import { DashboardDragContext } from "../state/use-dashboard.ts";
import type { InsertionLine } from "../engine/types.ts";

/**
 * Returns the current set of magnetic insertion lines emitted by the drag engine.
 *
 * Lines are only populated when `dropMode` is `'lines'` or `'both'` and a drag is in progress.
 * Each line includes its geometry, an `isActive` flag (true when the pointer is snapped to it),
 * and a `disabled` flag (true for self-adjacent lines, resize-lock conflicts, etc.).
 */
export function useInsertionLines(): InsertionLine[] {
  const ctx = useContext(DashboardDragContext);
  if (!ctx) return [];
  return ctx.insertionLines;
}
