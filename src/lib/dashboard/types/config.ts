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
  dropMode?: "classic" | "lines";
  lineSnapRadius?: number;
  lineCornerInset?: number;
  /**
   * Pixel radius around the pointer within which insertion lines are exposed
   * via `insertionLines`. When unset, all lines are exposed (default).
   * Setting a value (e.g. `120`) makes the engine emit only lines whose
   * nearest segment is within `lineProximityRadius` pixels of the pointer.
   * The active (currently-snapped) line is always exposed regardless of distance.
   */
  lineProximityRadius?: number;
}

/**
 * Breakpoint widths (in pixels) for responsive column count.
 */
export interface ResponsiveBreakpoints {
  sm?: number;
  md?: number;
  lg?: number;
}
