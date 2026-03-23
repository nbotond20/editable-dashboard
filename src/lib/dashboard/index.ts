export type {
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

export {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  DEFAULT_WIDGET_HEIGHT,
  DRAG_ACTIVATION_THRESHOLD,
  TOUCH_DRAG_ACTIVATION_DELAY,
  TOUCH_MOVE_TOLERANCE,
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
} from "./constants.ts";

export { DashboardProvider } from "./components/DashboardProvider.tsx";

export { useDashboard } from "./state/use-dashboard.ts";
export type { UseActionsOptions } from "./state/use-dashboard.ts";

export { computeLayout } from "./layout/compute-layout.ts";
export { getResponsiveColumns } from "./layout/responsive-columns.ts";
export { computeDropTarget } from "./drag/drop-indicator.ts";
export { useAutoScroll } from "./drag/use-auto-scroll.ts";

export { useKeyboardDrag } from "./drag/use-keyboard-drag.ts";
export { useDragAnnouncements } from "./drag/use-drag-announcements.ts";

export {
  serializeDashboard,
  deserializeDashboard,
} from "./persistence/serialize.ts";

export type { UndoHistory } from "./state/undo-history.ts";
export {
  createUndoHistory,
  pushState,
  undo,
  redo,
  canUndo,
  canRedo,
} from "./state/undo-history.ts";
