import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";

export interface WidgetDefinition {
  type: string;
  label: string;
  defaultColSpan: number;
  minColSpan?: number;
  maxColSpan?: number;
  locked?: boolean;
  removable?: boolean;
  hideable?: boolean;
  resizable?: boolean;
}

export interface WidgetState {
  id: string;
  type: string;
  colSpan: number;
  visible: boolean;
  order: number;
  columnStart?: number;
  config?: Record<string, unknown>;
  locked?: boolean;
}

export interface DashboardState {
  widgets: WidgetState[];
  maxColumns: number;
  gap: number;
  containerWidth: number;
}

export interface WidgetLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colSpan: number;
}

export interface ComputedLayout {
  positions: Map<string, WidgetLayout>;
  totalHeight: number;
}

export interface DragState {
  activeId: string | null;
  dropTargetIndex: number | null;
  previewColSpan: number | null;
  previewLayout: ComputedLayout | null;
  isLongPressing: boolean;
  longPressTargetId: string | null;
}

export interface DropTarget {
  targetIndex: number;
  previewColSpan: number | null;
  affectedResizes: Array<{ id: string; colSpan: number }>;
  columnStart?: number;
  swapWithId?: string;
}

export type DashboardAction =
  | { type: "ADD_WIDGET"; widgetType: string; colSpan: number; config?: Record<string, unknown> }
  | { type: "REMOVE_WIDGET"; id: string }
  | { type: "TOGGLE_VISIBILITY"; id: string }
  | { type: "RESIZE_WIDGET"; id: string; colSpan: number }
  | { type: "REORDER_WIDGETS"; fromIndex: number; toIndex: number }
  | { type: "SET_CONTAINER_WIDTH"; width: number }
  | { type: "SET_MAX_COLUMNS"; maxColumns: number }
  | { type: "BATCH_UPDATE"; widgets: WidgetState[] }
  | { type: "UPDATE_WIDGET_CONFIG"; id: string; config: Record<string, unknown> }
  | { type: "SWAP_WIDGETS"; sourceId: string; targetId: string }
  | { type: "LOCK_WIDGET"; id: string }
  | { type: "UNLOCK_WIDGET"; id: string }
  | { type: "UNDO" }
  | { type: "REDO" };

export interface DashboardActions {
  addWidget: (widgetType: string, colSpan?: number, config?: Record<string, unknown>) => void;
  removeWidget: (id: string) => void;
  toggleVisibility: (id: string) => void;
  resizeWidget: (id: string, colSpan: number) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  setMaxColumns: (maxColumns: number) => void;
  batchUpdate: (widgets: WidgetState[]) => void;
  updateWidgetConfig: (id: string, config: Record<string, unknown>) => void;
  lockWidget: (id: string) => void;
  unlockWidget: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

export interface DragHandleA11yProps {
  role: 'button';
  tabIndex: 0;
  'aria-roledescription': 'sortable';
  'aria-label': string;
  'aria-pressed'?: boolean;
  'aria-describedby'?: string;
}

export interface DragHandleProps extends DragHandleA11yProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  style: { cursor: string; touchAction: string };
}

export interface WidgetSlotRenderProps {
  widget: WidgetState;
  dragHandleProps: DragHandleProps;
  isDragging: boolean;
  colSpan: number;
  resize: (colSpan: number) => void;
  remove: () => void;
  toggleVisibility: () => void;
}

export interface SerializedDashboard {
  version: number;
  widgets: WidgetState[];
  maxColumns: number;
  gap: number;
}

export interface KeyboardDragState {
  isKeyboardDragging: boolean;
  keyboardDragId: string | null;
  keyboardTargetIndex: number | null;
}

export interface ResponsiveBreakpoints {
  sm?: number;
  md?: number;
  lg?: number;
}

export type DashboardProviderProps = {
  definitions: WidgetDefinition[];
  maxColumns?: number;
  gap?: number;
  maxWidgets?: number;
  maxUndoDepth?: number;
  keyboardShortcuts?: boolean;
  canDrop?: (sourceId: string, targetIndex: number, state: DashboardState) => boolean;
  children: ReactNode;
} & (
  | {
      
      state: DashboardState;
      onStateChange: (state: DashboardState) => void;
      initialWidgets?: never;
    }
  | {
      
      state?: never;
      onStateChange?: never;
      initialWidgets?: WidgetState[];
    }
);

export interface DashboardContextValue {
  state: DashboardState;
  definitions: WidgetDefinition[];
  layout: ComputedLayout;
  actions: DashboardActions;
  canUndo: boolean;
  canRedo: boolean;
  phase: "idle" | "pending" | "dragging" | "keyboard-dragging" | "dropping";
  dragState: DragState;
  getDragPosition: () => { x: number; y: number } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  measureRef: (id: string) => (node: HTMLElement | null) => void;
  startDrag: (
    id: string,
    pointerId: number,
    initialPos: { x: number; y: number },
    element: HTMLElement,
    pointerType?: string
  ) => void;
  updateDragPointer: (pos: { x: number; y: number }) => void;
  endDrag: () => void;
  getA11yProps: (widgetId: string) => DragHandleA11yProps;
  handleKeyboardDrag: (widgetId: string, e: React.KeyboardEvent) => void;
  isWidgetLocked: (id: string) => boolean;
  isWidgetRemovable: (id: string) => boolean;
  isWidgetHideable: (id: string) => boolean;
  isWidgetResizable: (id: string) => boolean;
  canAddWidget: () => boolean;
}
