import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";

/**
 * The three dimensions along which a widget can be locked.
 *
 * - `"position"` — prevents dragging / reordering
 * - `"resize"` — prevents column-span changes
 * - `"remove"` — prevents deletion
 */
export type LockType = "position" | "resize" | "remove";

/**
 * Describes a category of widget available in the dashboard.
 *
 * Definitions act as a catalog — they are immutable at runtime and shared
 * across all instances of that widget type.
 *
 * @example
 * ```ts
 * const definitions: WidgetDefinition[] = [
 *   { type: "stats", label: "Statistics", defaultColSpan: 1 },
 *   { type: "chart", label: "Chart", defaultColSpan: 2, minColSpan: 1, maxColSpan: 3 },
 * ];
 * ```
 */
export interface WidgetDefinition {
  /** Unique identifier for this widget type (e.g. `"chart"`). */
  type: string;
  /** Human-readable display name shown in catalogs and accessibility labels. */
  label: string;
  /** Column span assigned to new instances of this type. */
  defaultColSpan: number;
  /** Minimum allowed column span. The resize action clamps to this value. */
  minColSpan?: number;
  /** Maximum allowed column span. The resize action clamps to this value. */
  maxColSpan?: number;
  /** When `true`, all instances of this type are locked from being dragged by default. Overridable per-instance via {@link WidgetState.lockPosition}. */
  lockPosition?: boolean;
  /** When `true`, all instances of this type are locked from being resized by default. Overridable per-instance via {@link WidgetState.lockResize}. */
  lockResize?: boolean;
  /** When `true`, all instances of this type are locked from being removed by default. Overridable per-instance via {@link WidgetState.lockRemove}. */
  lockRemove?: boolean;
}

/**
 * Runtime state of a single widget instance on the dashboard.
 *
 * Widget state is mutable through {@link DashboardActions}.
 */
export interface WidgetState {
  /** Unique instance identifier (typically a UUID). */
  id: string;
  /** References a {@link WidgetDefinition.type}. */
  type: string;
  /** Current width in grid columns. Clamped to `[1, maxColumns]`. */
  colSpan: number;
  /** Whether the widget is visible on the grid. */
  visible: boolean;
  /** Sort order — lower values appear first in the layout. */
  order: number;
  /** Column hint that forces the widget to start at a specific column. Set by column-shift drags; cleared on reorder. */
  columnStart?: number;
  /** Arbitrary per-widget configuration object. Use {@link DashboardActions.updateWidgetConfig} to modify. */
  config?: Record<string, unknown>;
  /** Per-instance override for position locking. Takes precedence over the definition's `lockPosition`. */
  lockPosition?: boolean;
  /** Per-instance override for resize locking. Takes precedence over the definition's `lockResize`. */
  lockResize?: boolean;
  /** Per-instance override for remove locking. Takes precedence over the definition's `lockRemove`. */
  lockRemove?: boolean;
}

/**
 * Complete state of the dashboard.
 *
 * In controlled mode this is the value you pass to `<DashboardProvider state={…}>`.
 */
export interface DashboardState {
  /** All widget instances (visible and hidden). */
  widgets: WidgetState[];
  /** Current number of grid columns. */
  maxColumns: number;
  /** Gap between widgets in pixels. */
  gap: number;
  /** Measured container width in pixels. Transient — not serialized, defaults to 0 before first measurement. */
  containerWidth: number;
}

/**
 * Computed position and size of a single widget in the layout.
 *
 * All values are in pixels relative to the grid container's top-left corner.
 */
export interface WidgetLayout {
  /** Widget ID. */
  id: string;
  /** Horizontal offset from the container's left edge. */
  x: number;
  /** Vertical offset from the container's top edge. */
  y: number;
  /** Computed width based on `colSpan`, `maxColumns`, `gap`, and `containerWidth`. */
  width: number;
  /** Measured height (or `DEFAULT_WIDGET_HEIGHT` before first measurement). */
  height: number;
  /** Effective column span (clamped to `[1, maxColumns]`). */
  colSpan: number;
}

/**
 * The result of running the layout algorithm.
 *
 * Contains computed positions for all visible widgets and the total grid height.
 */
export interface ComputedLayout {
  /** Maps each visible widget ID to its computed position and dimensions. */
  positions: Map<string, WidgetLayout>;
  /** Total height of the grid in pixels. Use for the container's `height` style. */
  totalHeight: number;
}

/**
 * Current drag interaction state exposed via {@link DashboardContextValue.dragState}.
 *
 * Use this to render drag previews, ghosts, and visual feedback.
 */
export interface DragState {
  /** ID of the widget currently being dragged, or `null` when idle. */
  activeId: string | null;
  /** Index where the widget would land if dropped now. */
  dropTargetIndex: number | null;
  /** If the drop would resize the dragged widget, the new span; otherwise `null`. */
  previewColSpan: number | null;
  /** Full computed layout reflecting the tentative drop position. Animate other widgets toward these positions for a live preview. */
  previewLayout: ComputedLayout | null;
  /** Whether a touch long-press is in progress (before drag activation). */
  isLongPressing: boolean;
  /** Widget ID being long-pressed, or `null`. */
  longPressTargetId: string | null;
}

/** Resolved drop target information produced by the drag engine. */
export interface DropTarget {
  /** Insertion index in the visible-sorted widget list. */
  targetIndex: number;
  /** New column span for the dragged widget, or `null` if unchanged. */
  previewColSpan: number | null;
  /** Other widgets that would be resized as part of this drop. */
  affectedResizes: Array<{ id: string; colSpan: number }>;
  /** Column hint for column-shift drops. */
  columnStart?: number;
  /** ID of the widget to swap with (for cross-row swaps). */
  swapWithId?: string;
}

/**
 * Discriminated union of all state reducer actions.
 *
 * Most consumers interact through {@link DashboardActions} rather than dispatching these directly.
 */
export type DashboardAction =
  | { type: "ADD_WIDGET"; widgetType: string; colSpan: number; config?: Record<string, unknown> }
  | { type: "REMOVE_WIDGET"; id: string }
  | { type: "RESIZE_WIDGET"; id: string; colSpan: number }
  | { type: "REORDER_WIDGETS"; fromIndex: number; toIndex: number }
  | { type: "SET_CONTAINER_WIDTH"; width: number }
  | { type: "SET_MAX_COLUMNS"; maxColumns: number }
  | { type: "BATCH_UPDATE"; widgets: WidgetState[] }
  | { type: "UPDATE_WIDGET_CONFIG"; id: string; config: Record<string, unknown> }
  | { type: "SWAP_WIDGETS"; sourceId: string; targetId: string }
  | { type: "SET_WIDGET_LOCK"; id: string; lockType: LockType; locked: boolean }
  | { type: "UNDO" }
  | { type: "REDO" };

/**
 * Stable, memoized action dispatchers returned by {@link useDashboard}.
 *
 * All methods respect the widget lock system — locked actions are silently ignored.
 */
export interface DashboardActions {
  /** Add a new widget instance. `colSpan` defaults to the definition's `defaultColSpan`. */
  addWidget: (widgetType: string, colSpan?: number, config?: Record<string, unknown>) => void;
  /** Remove a widget by ID. Respects remove lock. */
  removeWidget: (id: string) => void;
  /** Change a widget's column span. Clamped to `[1, maxColumns]`. Respects resize lock. */
  resizeWidget: (id: string, colSpan: number) => void;
  /** Move a widget from one position to another. Indices are into the visible, sorted list. */
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  /** Change the grid column count. Widgets with `colSpan` exceeding the new max are clamped. */
  setMaxColumns: (maxColumns: number) => void;
  /** Replace the entire widgets array. Used internally for swaps and bulk operations. */
  batchUpdate: (widgets: WidgetState[]) => void;
  /** Shallow-merge into a widget's `config` object. */
  updateWidgetConfig: (id: string, config: Record<string, unknown>) => void;
  /** Set or clear a lock on a widget instance. */
  setWidgetLock: (id: string, lockType: LockType, locked: boolean) => void;
  /** Undo the last undoable action. */
  undo: () => void;
  /** Redo the last undone action. */
  redo: () => void;
}

/** Accessibility attributes for a drag handle element. Spread onto a `<button>` or similar. */
export interface DragHandleA11yProps {
  role: 'button';
  tabIndex: 0;
  'aria-roledescription': 'sortable';
  'aria-label': string;
  'aria-pressed'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Complete props to spread onto a drag handle element.
 *
 * Extends {@link DragHandleA11yProps} with pointer, keyboard, and style bindings.
 */
export interface DragHandleProps extends DragHandleA11yProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  style: { cursor: string; touchAction: string };
}

/** Props passed to a widget slot render function. */
export interface WidgetSlotRenderProps {
  /** The widget instance data. */
  widget: WidgetState;
  /** Spread onto your drag handle element. */
  dragHandleProps: DragHandleProps;
  /** Whether this widget is actively being dragged. */
  isDragging: boolean;
  /** Current column span. */
  colSpan: number;
  /** Resize this widget to the given column span. */
  resize: (colSpan: number) => void;
  /** Remove this widget from the dashboard. */
  remove: () => void;
}

/**
 * JSON-serializable snapshot of a dashboard, produced by {@link serializeDashboard}.
 *
 * The `version` field enables forward-compatible schema evolution.
 */
export interface SerializedDashboard {
  /** Schema version (currently `2`). */
  version: number;
  /** All widget instances. */
  widgets: WidgetState[];
  /** Column count. */
  maxColumns: number;
  /** Gap in pixels. */
  gap: number;
}

/** Keyboard drag state tracked internally by the provider. */
export interface KeyboardDragState {
  isKeyboardDragging: boolean;
  keyboardDragId: string | null;
  keyboardTargetIndex: number | null;
}

/**
 * Breakpoint widths (in pixels) for responsive column count.
 *
 * Defaults: `sm = 480`, `md = 768`, `lg = 1024`.
 *
 * @see {@link getResponsiveColumns}
 */
export interface ResponsiveBreakpoints {
  /** Below this width: 1 column. Default `480`. */
  sm?: number;
  /** Below this width: 2 columns. Default `768`. */
  md?: number;
  /** Below this width: 3 columns; at or above: 4 columns. Default `1024`. */
  lg?: number;
}

/**
 * Props for the `<DashboardProvider>` component.
 *
 * Supports two modes:
 *
 * - **Uncontrolled** — pass `initialWidgets` and let the provider manage state internally.
 * - **Controlled** — pass `state` + `onStateChange` for external state management (undo/redo integration, server sync, etc.).
 *
 * @example
 * ```tsx
 * // Uncontrolled
 * <DashboardProvider definitions={defs} initialWidgets={widgets}>
 *   <MyGrid />
 * </DashboardProvider>
 *
 * // Controlled
 * <DashboardProvider definitions={defs} state={state} onStateChange={setState}>
 *   <MyGrid />
 * </DashboardProvider>
 * ```
 */
export type DashboardProviderProps = {
  /** Widget type definitions (catalog). */
  definitions: WidgetDefinition[];
  /** Number of grid columns. @defaultValue 2 */
  maxColumns?: number;
  /** Gap between widgets in pixels. @defaultValue 16 */
  gap?: number;
  /** Maximum number of widgets allowed on the dashboard. */
  maxWidgets?: number;
  /** Maximum number of undo states to retain. @defaultValue 50 */
  maxUndoDepth?: number;
  /** Enable `Ctrl+Z` / `Ctrl+Y` keyboard shortcuts for undo/redo. @defaultValue true */
  keyboardShortcuts?: boolean;
  /** Custom drop validation. Return `false` to prevent a drop at the given `targetIndex`. */
  canDrop?: (sourceId: string, targetIndex: number, state: DashboardState) => boolean;
  children: ReactNode;
} & (
  | {
      /** Controlled mode: externally managed dashboard state. */
      state: DashboardState;
      /** Controlled mode: called on every state change. */
      onStateChange: (state: DashboardState) => void;
      initialWidgets?: never;
    }
  | {
      state?: never;
      onStateChange?: never;
      /** Uncontrolled mode: seed widgets for the initial render. */
      initialWidgets?: WidgetState[];
    }
);

/**
 * The full context value returned by {@link useDashboard}.
 *
 * Provides access to state, layout, actions, drag state, refs, and interaction handlers.
 */
export interface DashboardContextValue {
  /** Current dashboard state. */
  state: DashboardState;
  /** Widget type definitions passed to the provider. */
  definitions: WidgetDefinition[];
  /** Computed layout for the current state. */
  layout: ComputedLayout;
  /** Stable, memoized action dispatchers. */
  actions: DashboardActions;
  /** Whether an undo operation is available. */
  canUndo: boolean;
  /** Whether a redo operation is available. */
  canRedo: boolean;
  /** Current drag engine phase. */
  phase: "idle" | "pending" | "dragging" | "keyboard-dragging" | "dropping";
  /** Current drag interaction state for rendering previews. */
  dragState: DragState;
  /** Returns the dragged widget's current position relative to the container, or `null` when idle. */
  getDragPosition: () => { x: number; y: number } | null;
  /** Attach to your grid container element for width measurement. */
  containerRef: React.Ref<HTMLDivElement>;
  /** Returns a callback ref for a widget. Attach to each widget's DOM node for height measurement. */
  measureRef: (id: string) => (node: HTMLElement | null) => void;
  /** Initiate a pointer-based drag. Call from a `pointerdown` handler. */
  startDrag: (
    id: string,
    pointerId: number,
    initialPos: { x: number; y: number },
    element: HTMLElement,
    pointerType?: string
  ) => void;
  /** Manually update the drag pointer position (advanced). */
  updateDragPointer: (pos: { x: number; y: number }) => void;
  /** Programmatically cancel an active drag. */
  endDrag: () => void;
  /** Get ARIA accessibility attributes for a drag handle. */
  getA11yProps: (widgetId: string) => DragHandleA11yProps;
  /** Handle keyboard events for keyboard-based dragging. Bind to the drag handle's `onKeyDown`. */
  handleKeyboardDrag: (widgetId: string, e: React.KeyboardEvent) => void;
  /** Check whether a specific lock is active for a widget (considering both instance and definition locks). */
  isWidgetLockActive: (id: string, lockType: LockType) => boolean;
  /** Check whether the maximum widget count has been reached. */
  canAddWidget: () => boolean;
}
