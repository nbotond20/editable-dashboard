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
  DashboardStableContextValue,
  DashboardDragContextValue,
  SerializedDashboard,
  ResponsiveBreakpoints,
  DragConfig,
} from "./types.ts";

export type { CommittedOperation, CommitSource } from "./engine/types.ts";

export {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  DEFAULT_WIDGET_HEIGHT,
  DRAG_ACTIVATION_THRESHOLD,
} from "./constants.ts";

export { DashboardProvider } from "./react/DashboardProvider.tsx";
export { useDashboard, useDashboardStable, useDashboardDrag } from "./state/use-dashboard.ts";
export type { UseActionsOptions } from "./state/use-dashboard.ts";

export { computeLayout } from "./layout/compute-layout.ts";
export { getResponsiveColumns } from "./layout/responsive-columns.ts";

export {
  serializeDashboard,
  deserializeDashboard,
  validateSerializedDashboard,
  CURRENT_SERIALIZATION_VERSION,
} from "./persistence/serialize.ts";
