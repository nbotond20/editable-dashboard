/**
 * Computed position and size of a single widget in the layout.
 *
 * All values are in pixels relative to the grid container's top-left corner.
 */
export interface WidgetLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colSpan: number;
}

/**
 * The result of running the layout algorithm.
 */
export interface ComputedLayout {
  positions: Map<string, WidgetLayout>;
  totalHeight: number;
}
