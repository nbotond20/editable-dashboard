const PRESETS = {
  snappy: { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 },
  bouncy: { type: "spring" as const, stiffness: 400, damping: 20, mass: 0.6 },
  smooth: { type: "spring" as const, stiffness: 200, damping: 28, mass: 1.2 },
  gentle: { type: "spring" as const, stiffness: 150, damping: 22, mass: 1.0 },
};

export const LAYOUT_SPRING = PRESETS.snappy;
