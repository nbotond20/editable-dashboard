import { createContext, useContext, useMemo } from "react";
import type { DashboardContextValue, DashboardStableContextValue, DashboardDragContextValue } from "../types.ts";

export { isLockActive } from "../locks.ts";
export { useActions } from "./use-actions.ts";
export type { UseActionsOptions } from "./use-actions.ts";

export const DashboardStableContext = createContext<DashboardStableContextValue | null>(null);
export const DashboardDragContext = createContext<DashboardDragContextValue | null>(null);

/**
 * Access the stable (non-drag) portion of the dashboard context.
 * This context does not change during drag operations, reducing re-renders.
 */
export function useDashboardStable(): DashboardStableContextValue {
  const ctx = useContext(DashboardStableContext);
  if (!ctx)
    throw new Error("useDashboardStable must be used within DashboardProvider");
  return ctx;
}

/**
 * Access the volatile drag portion of the dashboard context.
 * This context changes during drag operations (phase, dragState).
 */
export function useDashboardDrag(): DashboardDragContextValue {
  const ctx = useContext(DashboardDragContext);
  if (!ctx)
    throw new Error("useDashboardDrag must be used within DashboardProvider");
  return ctx;
}

/**
 * Access the full dashboard context.
 *
 * Must be called inside a `<DashboardProvider>`. Returns state, layout,
 * actions, drag state, refs, and interaction handlers.
 *
 * @returns The {@link DashboardContextValue} for the nearest provider.
 * @throws {Error} If called outside of a `<DashboardProvider>`.
 *
 * @example
 * ```tsx
 * function MyGrid() {
 *   const { state, layout, actions, containerRef, measureRef } = useDashboard();
 *   // ...
 * }
 * ```
 */
export function useDashboard(): DashboardContextValue {
  const stable = useDashboardStable();
  const drag = useDashboardDrag();
  return useMemo(() => ({ ...stable, ...drag }), [stable, drag]);
}
