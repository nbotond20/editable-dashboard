/** Spring configs for each animation use case. */
export const SPRINGS = {
  /** Widget position shifts during layout changes. */
  layout: { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 },
  /** Catalog panel slide-in/out. */
  panel: { type: "spring" as const, stiffness: 400, damping: 35 },
} as const;

/** Strong ease-out for drop settle (WAAPI). Per Emil Kowalski's recommendation. */
export const SETTLE_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Duration in ms for the drop settle animation. */
export const SETTLE_DURATION = 300;

export const LAYOUT_SPRING = SPRINGS.layout;
