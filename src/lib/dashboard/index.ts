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

export type {
  ExternalDragItem,
  ExternalDragSourceProps,
  ExternalDropEvent,
} from "./types/external-drag.ts";

export {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  DEFAULT_WIDGET_HEIGHT,
  DRAG_ACTIVATION_THRESHOLD,
  EXTERNAL_PHANTOM_ID,
} from "./constants.ts";

export { DashboardProvider } from "./react/DashboardProvider.tsx";
export { useDashboard, useDashboardStable, useDashboardDrag } from "./state/use-dashboard.ts";
export { useExternalDragSource } from "./react/use-external-drag-source.ts";
export { useTrashZone } from "./react/use-trash-zone.ts";
export { useWidgetSlot } from "./react/use-widget-slot.ts";
export type { UseWidgetSlotResult } from "./react/use-widget-slot.ts";
export { useDragFollow } from "./react/use-drag-follow.ts";
export type { DragFollowResult, DragFollowOptions, SettleConfig } from "./react/use-drag-follow.ts";
export type { TrashZoneResult } from "./react/use-trash-zone.ts";
export type { UseActionsOptions } from "./state/use-dashboard.ts";

export { computeLayout } from "./layout/compute-layout.ts";
export { getResponsiveColumns } from "./layout/responsive-columns.ts";

export {
  serializeDashboard,
  deserializeDashboard,
  validateSerializedDashboard,
  CURRENT_SERIALIZATION_VERSION,
} from "./persistence/serialize.ts";
