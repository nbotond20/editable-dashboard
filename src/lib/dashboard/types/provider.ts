import type { ReactNode } from "react";
import type { CommittedOperation } from "../engine/types.ts";
import type { LockType, WidgetDefinition, WidgetState } from "./widget.ts";
import type { DashboardState, DashboardActions } from "./state.ts";
import type { ComputedLayout } from "./layout.ts";
import type { DragState, DragHandleA11yProps } from "./drag.ts";
import type { DashboardError, DragConfig, ResponsiveBreakpoints } from "./config.ts";

/**
 * Props for the `<DashboardProvider>` component.
 */
export type DashboardProviderProps = {
  definitions: WidgetDefinition[];
  maxColumns?: number;
  gap?: number;
  maxWidgets?: number;
  maxUndoDepth?: number;
  keyboardShortcuts?: boolean;
  canDrop?: (sourceId: string, targetIndex: number, state: DashboardState) => boolean;
  dragConfig?: DragConfig;
  responsiveBreakpoints?: ResponsiveBreakpoints;
  onError?: (error: DashboardError) => void;
  onDragStart?: (event: { widgetId: string; phase: 'pointer' | 'keyboard' }) => void;
  onDragEnd?: (event: { widgetId: string; operation: CommittedOperation; cancelled: boolean }) => void;
  onWidgetAdd?: (event: { widget: WidgetState }) => void;
  onWidgetRemove?: (event: { widgetId: string }) => void;
  onWidgetResize?: (event: { widgetId: string; previousColSpan: number; newColSpan: number }) => void;
  onWidgetReorder?: (event: { widgetId: string; fromIndex: number; toIndex: number }) => void;
  onWidgetConfigChange?: (event: { widgetId: string; config: Record<string, unknown> }) => void;
  onChange?: (state: DashboardState) => void;
  children: ReactNode;
} & (
  | {
      state: WidgetState[];
      onStateChange: (widgets: WidgetState[]) => void;
      initialWidgets?: undefined;
    }
  | {
      state?: undefined;
      onStateChange?: undefined;
      initialWidgets?: WidgetState[];
    }
);

/**
 * Stable context values that change only on user actions, not during drag.
 */
export interface DashboardStableContextValue {
  state: DashboardState;
  definitions: WidgetDefinition[];
  layout: ComputedLayout;
  actions: DashboardActions;
  canUndo: boolean;
  canRedo: boolean;
  getDragPosition: () => { x: number; y: number } | null;
  containerRef: React.Ref<HTMLDivElement>;
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
  isWidgetLockActive: (id: string, lockType: LockType) => boolean;
  canAddWidget: () => boolean;
}

/**
 * Volatile context values that change during drag operations.
 */
export interface DashboardDragContextValue {
  phase: "idle" | "pending" | "dragging" | "keyboard-dragging" | "dropping";
  dragState: DragState;
}

/**
 * The full context value returned by {@link useDashboard}.
 */
export interface DashboardContextValue extends DashboardStableContextValue, DashboardDragContextValue {}
