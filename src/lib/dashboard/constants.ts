/** Default number of grid columns. */
export const DEFAULT_MAX_COLUMNS = 2;

/** Default gap between widgets in pixels. */
export const DEFAULT_GAP = 16;

/** Fallback widget height in pixels before the first ResizeObserver measurement. */
export const DEFAULT_WIDGET_HEIGHT = 200;

/** Minimum pointer movement in pixels before a drag activates. */
export const DRAG_ACTIVATION_THRESHOLD = 5;

/** Delay in milliseconds before a touch-and-hold activates a drag. */
export const TOUCH_DRAG_ACTIVATION_DELAY = 200;

/** Maximum pointer drift in pixels allowed during a touch long-press. */
export const TOUCH_MOVE_TOLERANCE = 10;

/** Distance in pixels from viewport edge that triggers auto-scroll during drag. */
export const AUTO_SCROLL_EDGE_SIZE = 96;

/** Maximum auto-scroll speed in pixels per second, reached at the very edge of the viewport. */
export const AUTO_SCROLL_MAX_SPEED = 1600;

/** Minimum auto-scroll speed in pixels per second, applied as soon as the pointer enters the edge zone. */
export const AUTO_SCROLL_MIN_SPEED = 260;

/** Time in ms that drag operations stay suppressed after auto-scroll last moved the view. */
export const SCROLL_INTERACTION_LOCK_MS = 1000;

/** Dwell time in milliseconds before a cross-row swap activates. */
export const SWAP_DWELL_MS = 0;

/** Dwell time in milliseconds before an auto-resize operation activates. */
export const RESIZE_DWELL_MS = 600;

/** Dwell time in milliseconds before a shrunk widget maximizes in an empty row. */
export const EMPTY_ROW_MAXIMIZE_DWELL_MS = 600;

/** Duration of the drop animation in milliseconds. */
export const DROP_ANIMATION_DURATION = 250;

/** Widget ID used for the phantom placeholder during external drag-to-add. */
export const EXTERNAL_PHANTOM_ID = "__external_phantom__";

/** Default drop interaction mode. `'classic'` preserves all pre-line behavior. */
export const DEFAULT_DROP_MODE: "classic" | "lines" = "classic";

/** Pixel radius around an insertion line that magnetically snaps the pointer. */
export const DEFAULT_LINE_SNAP_RADIUS = 16;

/** Extra pixels the pointer must travel before leaving a snapped line (hysteresis). */
export const LINE_SNAP_HYSTERESIS = 8;

/** Pixel inset applied to insertion line endpoints so they don't run into widget rounded corners. */
export const DEFAULT_LINE_CORNER_INSET = 8;

/** Whether insertion lines are exposed for rendering. `false` hides them visually while keeping drag behavior intact. */
export const DEFAULT_SHOW_INSERTION_LINES = true;

/** Whether dragging may resize widgets. `false` restricts resizing to the explicit resize controls. */
export const DEFAULT_AUTO_RESIZE = true;

/**
 * Whether a pointer dragged outside the container snaps to the nearest edge
 * instead of resolving to `outside`. `false` preserves pre-existing behavior.
 */
export const DEFAULT_SNAP_OUTSIDE_TO_EDGES = false;
