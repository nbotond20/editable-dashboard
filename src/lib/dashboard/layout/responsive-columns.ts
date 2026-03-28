import type { ResponsiveBreakpoints } from "../types.ts";

const DEFAULT_BREAKPOINTS: Required<ResponsiveBreakpoints> = {
  sm: 480,
  md: 768,
  lg: 1024,
};

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
