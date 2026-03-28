import type { ResponsiveBreakpoints } from "../types.ts";

const DEFAULT_BREAKPOINTS: Required<ResponsiveBreakpoints> = {
  sm: 480,
  md: 768,
  lg: 1024,
};

/**
 * Determine the appropriate column count for a given container width.
 *
 * Returns 1 column below `sm`, 2 below `md`, 3 below `lg`, and 4 at or above `lg`.
 *
 * @param containerWidth - Current container width in pixels.
 * @param breakpoints - Custom breakpoints. Defaults: `sm = 480`, `md = 768`, `lg = 1024`.
 * @returns Column count (1–4).
 */
export function getResponsiveColumns(
  containerWidth: number,
  breakpoints?: ResponsiveBreakpoints
): number {
  const bp = {
    sm: breakpoints?.sm ?? DEFAULT_BREAKPOINTS.sm,
    md: breakpoints?.md ?? DEFAULT_BREAKPOINTS.md,
    lg: breakpoints?.lg ?? DEFAULT_BREAKPOINTS.lg,
  };

  if (containerWidth < bp.sm) return 1;
  if (containerWidth < bp.md) return 2;
  if (containerWidth < bp.lg) return 3;
  return 4;
}
