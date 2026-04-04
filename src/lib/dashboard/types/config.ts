/**
 * Structured error emitted by the dashboard when validation fails.
 */
export type DashboardError = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

/**
 * User-facing drag / interaction timing configuration.
 */
export interface DragConfig {
  activationThreshold?: number;
  touchActivationDelay?: number;
  touchMoveTolerance?: number;
  autoScrollEdgeSize?: number;
  autoScrollMaxSpeed?: number;
  swapDwellMs?: number;
  resizeDwellMs?: number;
  dropAnimationDuration?: number;
}

/**
 * Breakpoint widths (in pixels) for responsive column count.
 */
export interface ResponsiveBreakpoints {
  sm?: number;
  md?: number;
  lg?: number;
}
