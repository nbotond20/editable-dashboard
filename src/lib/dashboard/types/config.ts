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
  /**
   * Whether insertion lines are exposed via `insertionLines` for rendering.
   * Defaults to `true`. When `false`, the engine emits no lines (so consumers
   * draw nothing), but snapping, placement, and invalid-drop detection stay
   * fully functional — the lines are hidden visually only.
   */
  showInsertionLines?: boolean;
  /**
   * Whether dragging may resize widgets. Defaults to `true`. When `false`,
   * dragged and target widgets keep their column span in every mode: classic
   * hover never auto-resizes (stays a swap), and lines-mode drops that would
   * require redistributing or growing a widget become infeasible (red
   * placeholder) instead. Only the explicit resize controls change a span.
   */
  autoResize?: boolean;
}

/**
 * Breakpoint widths (in pixels) for responsive column count.
 */
export interface ResponsiveBreakpoints {
  sm?: number;
  md?: number;
  lg?: number;
}
