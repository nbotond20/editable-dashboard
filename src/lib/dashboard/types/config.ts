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
  /**
   * Whether a pointer dragged outside the container still resolves to the
   * nearest edge (top / bottom / outer sides) instead of `outside`. Defaults
   * to `false`. When `true`, the entire empty area around the container acts
   * as an invisible detection zone that snaps to the closest edge, making it
   * easy to place widgets at the very top, bottom, or outer columns. Snapping
   * to a far-away edge means dragging into surrounding empty space no longer
   * cancels the drop.
   */
  snapOutsideToEdges?: boolean;
  /**
   * When `true`, lay widgets out in strict equal-height rows instead of
   * masonry: row membership follows `order` + `colSpan`, and every widget in a
   * row takes the height of the tallest member. Defaults to `false` (masonry).
   * Consumers should supply natural (un-stretched) heights via the provider's
   * `heights` prop and render each widget at its computed `position.height`.
   */
  equalRowHeights?: boolean;
}

/**
 * Breakpoint widths (in pixels) for responsive column count.
 */
export interface ResponsiveBreakpoints {
  sm?: number;
  md?: number;
  lg?: number;
}
