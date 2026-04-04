import { createContext, useContext } from "react";
import type { DashboardContextValue } from "../types.ts";

export { isLockActive } from "../locks.ts";
export { useActions } from "./use-actions.ts";
export type { UseActionsOptions } from "./use-actions.ts";

export const DashboardContext = createContext<DashboardContextValue | null>(
  null
);

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
export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
