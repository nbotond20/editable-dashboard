// ── Types ──────────────────────────────────────────────────────────────────
export type {
  LockType,
  WidgetDefinition,
  WidgetState,
  DashboardState,
  WidgetLayout,
  ComputedLayout,
  DragState,
  DropTarget,
  DashboardAction,
  DashboardActions,
  DragHandleA11yProps,
  DragHandleProps,
  KeyboardDragState,
  WidgetSlotRenderProps,
  DashboardProviderProps,
  DashboardContextValue,
  SerializedDashboard,
  ResponsiveBreakpoints,
} from "./types.ts";

// ── Constants ──────────────────────────────────────────────────────────────
export {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  DEFAULT_WIDGET_HEIGHT,
  DRAG_ACTIVATION_THRESHOLD,
} from "./constants.ts";

// ── Components & Hooks ─────────────────────────────────────────────────────
export { DashboardProvider } from "./react/DashboardProvider.tsx";
export { useDashboard } from "./state/use-dashboard.ts";
export type { UseActionsOptions } from "./state/use-dashboard.ts";

// ── Layout ─────────────────────────────────────────────────────────────────
export { computeLayout } from "./layout/compute-layout.ts";
export { getResponsiveColumns } from "./layout/responsive-columns.ts";

// ── Persistence ────────────────────────────────────────────────────────────
export {
  serializeDashboard,
  deserializeDashboard,
} from "./persistence/serialize.ts";
