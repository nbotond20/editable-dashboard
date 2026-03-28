// ── Types ──────────────────────────────────────────────────────────────────
export type {
  LockType,
  WidgetDefinition,
  WidgetState,
  DashboardError,
  DashboardState,
  DashboardStateInput,
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
  DragConfig,
} from "./types.ts";

// Re-export CommittedOperation so consumers can type onDragEnd callbacks
// without reaching into the engine-entry.
export type { CommittedOperation } from "./engine/types.ts";

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
  validateSerializedDashboard,
  CURRENT_SERIALIZATION_VERSION,
} from "./persistence/serialize.ts";
