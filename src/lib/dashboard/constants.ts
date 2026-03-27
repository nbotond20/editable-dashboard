export const DEFAULT_MAX_COLUMNS = 2;
export const DEFAULT_GAP = 16;
export const DEFAULT_WIDGET_HEIGHT = 200;
export const DRAG_ACTIVATION_THRESHOLD = 5;

/** Milliseconds a touch must be held before drag activates. */
export const TOUCH_DRAG_ACTIVATION_DELAY = 200;

/** Pixels of movement allowed during the long-press window before cancelling. */
export const TOUCH_MOVE_TOLERANCE = 10;

/** Distance from viewport edge (px) where auto-scroll kicks in. */
export const AUTO_SCROLL_EDGE_SIZE = 60;

/** Maximum scroll speed in pixels per animation frame. */
export const AUTO_SCROLL_MAX_SPEED = 15;

// ─── Engine dwell timing ─────────────────────────────────────

/** Milliseconds hovering over a widget before a swap intent activates. */
export const SWAP_DWELL_MS = 150;

/** Milliseconds hovering over a widget before switching to auto-resize intent. */
export const RESIZE_DWELL_MS = 500;

/** Milliseconds for the drop animation phase before returning to idle. */
export const DROP_ANIMATION_DURATION = 250;
