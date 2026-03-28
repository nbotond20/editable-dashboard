# editable-dashboard

A headless, zero-dependency React library for building fully customizable dashboard layouts with drag-and-drop reordering, dynamic resizing, and smart bin-packing.

[![npm](https://img.shields.io/npm/v/@nbotond20/editable-dashboard)](https://www.npmjs.com/package/@nbotond20/editable-dashboard)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nbotond20/editable-dashboard)](https://bundlephobia.com/package/@nbotond20/editable-dashboard)

Demo: https://nbotond20.github.io/editable-dashboard/

---

## Features

- **Headless architecture** -- you bring your own UI components and animation library
- **Bin-packing layout engine** -- widgets flow into columns automatically, filling gaps efficiently
- **5 intelligent drag strategies** -- insert, swap, side-drop, row squeeze, and column shift
- **Controlled or uncontrolled** -- manage state externally or let the provider handle it
- **Serialization built in** -- save and restore dashboard layouts with `serializeDashboard` / `deserializeDashboard`
- **Pointer-based drag system** -- works with mouse and touch; supports Escape to cancel
- **Auto-measuring heights** -- widgets are measured via `ResizeObserver`; no fixed heights required
- **Configurable columns** -- 1, 2, or 3 column layouts with adjustable gaps
- **Fully typed** -- written in TypeScript with every type exported
- **Widget locking** -- lock position, resize, or removal at the definition or per-instance level
- **Undo/redo** -- built-in history with `Ctrl+Z` / `Ctrl+Y` keyboard shortcuts
- **Keyboard drag** -- full keyboard navigation with arrow keys, Space, and Escape
- **Tree-shakeable** -- marked `sideEffects: false`; import only what you use
- **Configurable drag behavior** -- tune activation thresholds, dwell times, scroll speed, and more via `dragConfig`
- **Lifecycle callbacks** -- `onDragStart`, `onDragEnd`, `onWidgetAdd`, `onWidgetRemove`, and more
- **Error handling** -- `onError` callback with typed error codes for validation failures
- **Input validation** -- definitions, props, and serialized data are validated with descriptive errors

---

## Quick Start

### Installation

```bash
npm install @nbotond20/editable-dashboard
# or
yarn add @nbotond20/editable-dashboard
# or
pnpm add @nbotond20/editable-dashboard
```

> **Peer dependencies:** React 18+ (including React 19) and ReactDOM 18+.

### Minimal Example

```tsx
import {
  DashboardProvider,
  useDashboard,
  type WidgetDefinition,
  type WidgetState,
} from "@nbotond20/editable-dashboard";

// 1. Define your widget types
const definitions: WidgetDefinition[] = [
  { type: "stats", label: "Statistics", defaultColSpan: 1 },
  { type: "chart", label: "Chart", defaultColSpan: 2 },
];

// 2. Seed initial widgets (optional)
const initialWidgets: WidgetState[] = [
  { id: "w1", type: "stats", colSpan: 1, visible: true, order: 0 },
  { id: "w2", type: "chart", colSpan: 2, visible: true, order: 1 },
];

// 3. Build your grid
function MyGrid() {
  const { state, layout, actions, dragState, containerRef, measureRef, startDrag, getDragPosition } =
    useDashboard();

  const visibleWidgets = state.widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  const activeLayout = dragState.previewLayout ?? layout;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height: activeLayout.totalHeight || "auto",
      }}
    >
      {visibleWidgets.map((widget) => {
        const pos = activeLayout.positions.get(widget.id);
        if (!pos) return null;

        return (
          <div
            key={widget.id}
            ref={measureRef(widget.id)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.width,
            }}
          >
            {/* Drag handle */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                startDrag(
                  widget.id,
                  e.pointerId,
                  { x: e.clientX, y: e.clientY },
                  e.currentTarget as HTMLElement
                );
              }}
              style={{ cursor: "grab", touchAction: "none" }}
            >
              Drag
            </button>

            {/* Your widget content */}
            <div>Widget: {widget.type}</div>
          </div>
        );
      })}
    </div>
  );
}

// 4. Wrap in the provider
export default function App() {
  return (
    <DashboardProvider
      definitions={definitions}
      initialWidgets={initialWidgets}
      maxColumns={2}
      gap={16}
    >
      <MyGrid />
    </DashboardProvider>
  );
}
```

---

## Core Concepts

### Widget Definitions vs Widget State

| Concept | Purpose | Mutable at runtime? |
|---------|---------|---------------------|
| **`WidgetDefinition`** | Describes a *type* of widget (label, default span, constraints). Passed to the provider. | Replace the whole `definitions` array. |
| **`WidgetState`** | Represents an *instance* of a widget on the dashboard (id, current span, visibility, order). | Yes -- via actions (`resizeWidget`, `removeWidget`, etc.). |

Definitions are a catalog; state is the live layout.

### The Headless Approach

The library provides **state, layout coordinates, and drag behavior** -- but zero rendered DOM beyond the context provider. You build your grid container, your widget wrappers, your drag handles, and your animations. This means you can use Framer Motion, CSS transitions, React Spring, or nothing at all.

### Layout Engine

The layout engine uses a **first-fit bin-packing algorithm**:

1. Widgets are sorted by their `order` (hidden widgets are skipped).
2. For each widget, the algorithm scans all possible column start positions and picks the one with the lowest Y value (the "highest" available slot).
3. If a widget has a `columnStart` hint, that column is preferred instead.
4. Widget widths are computed from their `colSpan`, the `containerWidth`, and the `gap`.
5. Heights come from real DOM measurements via `ResizeObserver` (falling back to 200px).

### Drag-and-Drop System

Drag is **simulation-based**: on every animation frame, the system generates candidate layouts for every possible drop position and picks the one whose computed center is closest to the pointer. A 2-frame hysteresis filter prevents flickering between positions. Five families of candidates are evaluated -- see [Drag Strategies](#drag-strategies) below.

---

## API Reference

### `<DashboardProvider>`

The root context provider. All hooks must be called within its subtree.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `definitions` | `WidgetDefinition[]` | **(required)** | Catalog of available widget types. |
| `maxColumns` | `number` | `2` | Number of grid columns. |
| `gap` | `number` | `16` | Gap in pixels between widgets. |
| `maxWidgets` | `number` | -- | Maximum number of widgets allowed. |
| `maxUndoDepth` | `number` | `50` | Maximum number of undo states to retain. |
| `keyboardShortcuts` | `boolean` | `true` | Enable `Ctrl+Z` / `Ctrl+Y` for undo/redo. |
| `canDrop` | `(sourceId, targetIndex, state) => boolean` | -- | Custom drop validation. Return `false` to prevent a drop. |
| `dragConfig` | `DragConfig` | -- | Fine-tune drag activation, dwell times, scroll speed, and animation duration. See [DragConfig](#dragconfig). |
| `responsiveBreakpoints` | `ResponsiveBreakpoints` | -- | Customize breakpoints for `getResponsiveColumns()`. |
| `onError` | `(error: DashboardError) => void` | -- | Called when a validation error occurs (invalid widget type, exceeded max widgets, etc.). See [Error Handling](#error-handling). |
| `onDragStart` | `(event: { widgetId, phase }) => void` | -- | Called when a drag begins. `phase` is `'pointer'` or `'keyboard'`. |
| `onDragEnd` | `(event: { widgetId, operation, cancelled }) => void` | -- | Called when a drag ends. Includes the committed operation and whether it was cancelled. |
| `onWidgetAdd` | `(event: { widget }) => void` | -- | Called after a widget is added. |
| `onWidgetRemove` | `(event: { widgetId }) => void` | -- | Called after a widget is removed. |
| `onWidgetResize` | `(event: { widgetId, previousColSpan, newColSpan }) => void` | -- | Called after a widget is resized. |
| `onWidgetReorder` | `(event: { widgetId, fromIndex, toIndex }) => void` | -- | Called after widgets are reordered. |
| `onWidgetConfigChange` | `(event: { widgetId, config }) => void` | -- | Called after a widget's config is updated. |
| `onChange` | `(state: DashboardState) => void` | -- | Called on every state change in both controlled and uncontrolled modes. |
| `children` | `ReactNode` | **(required)** | Child components. |

**Uncontrolled mode** (default):

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialWidgets` | `WidgetState[]` | `[]` | Seed the dashboard with pre-existing widgets. |

**Controlled mode** (pass both `state` and `onStateChange`):

| Prop | Type | Description |
|------|------|-------------|
| `state` | `DashboardStateInput` | The dashboard state managed externally (without transient `containerWidth`). |
| `onStateChange` | `(state: DashboardStateInput) => void` | Called with the next state after every action. Does not include `containerWidth`. |

The two modes are mutually exclusive. In controlled mode, do not pass `initialWidgets`. In uncontrolled mode, do not pass `state` or `onStateChange`.

> **Note:** Controlled mode uses `DashboardStateInput` (without `containerWidth`) rather than `DashboardState`. The provider manages `containerWidth` internally since it's a transient measurement value.

---

### `useDashboard()`

Returns the full dashboard context. Must be called inside `<DashboardProvider>`.

```ts
const {
  state,
  definitions,
  layout,
  actions,
  canUndo,
  canRedo,
  phase,
  dragState,
  getDragPosition,
  containerRef,
  measureRef,
  startDrag,
  updateDragPointer,
  endDrag,
  getA11yProps,
  handleKeyboardDrag,
  isWidgetLockActive,
  canAddWidget,
} = useDashboard();
```

#### `state: DashboardState`

The current dashboard state.

| Field | Type | Description |
|-------|------|-------------|
| `widgets` | `WidgetState[]` | All widget instances (visible and hidden). |
| `maxColumns` | `number` | Current column count. |
| `gap` | `number` | Current gap in pixels. |
| `containerWidth` | `number` | Measured container width (0 before first measurement). |

#### `definitions: WidgetDefinition[]`

The `definitions` array passed to the provider.

#### `layout: ComputedLayout`

The computed layout for the current state.

| Field | Type | Description |
|-------|------|-------------|
| `positions` | `Map<string, WidgetLayout>` | Maps each visible widget's `id` to its computed position and dimensions. |
| `totalHeight` | `number` | Total height of the grid in pixels. Use this for the container's height. |

Each `WidgetLayout` contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Widget ID. |
| `x` | `number` | Horizontal offset in pixels from the container's left edge. |
| `y` | `number` | Vertical offset in pixels from the container's top edge. |
| `width` | `number` | Computed width in pixels (based on `colSpan`, `maxColumns`, `gap`, and `containerWidth`). |
| `height` | `number` | Measured height in pixels (or `200` if not yet measured). |
| `colSpan` | `number` | Number of columns this widget spans. |

#### `actions: DashboardActions`

Stable, memoized action dispatchers.

| Method | Signature | Description |
|--------|-----------|-------------|
| `addWidget` | `(widgetType: string, colSpan?: number, config?: Record<string, unknown>) => void` | Add a new widget. If `colSpan` is omitted, uses the definition's `defaultColSpan` (or 1). |
| `removeWidget` | `(id: string) => void` | Remove a widget by ID. Respects remove lock. |
| `resizeWidget` | `(id: string, colSpan: number) => void` | Change a widget's column span. Clamped to `[1, maxColumns]`. Respects resize lock. |
| `reorderWidgets` | `(fromIndex: number, toIndex: number) => void` | Move a widget from one position to another (indices into the visible, sorted list). Clears all `columnStart` hints. |
| `setMaxColumns` | `(maxColumns: number) => void` | Change the column count. Widgets with a `colSpan` exceeding the new max are clamped. |
| `batchUpdate` | `(widgets: WidgetState[]) => void` | Replace the entire widgets array. Used internally by the drag system for swaps and resizes. |
| `updateWidgetConfig` | `(id: string, config: Record<string, unknown>) => void` | Shallow-merge into a widget's `config` object. |
| `showWidget` | `(id: string) => void` | Make a hidden widget visible again. |
| `hideWidget` | `(id: string) => void` | Soft-hide a widget (retained in state but removed from layout). |
| `setWidgetLock` | `(id: string, lockType: LockType, locked: boolean) => void` | Set or clear a lock on a widget instance. |
| `undo` | `() => void` | Undo the last undoable action. |
| `redo` | `() => void` | Redo the last undone action. |

#### `dragState: DragState`

The current drag state. Use this to render drag previews and ghosts.

| Field | Type | Description |
|-------|------|-------------|
| `activeId` | `string \| null` | ID of the widget currently being dragged, or `null`. |
| `dropTargetIndex` | `number \| null` | The index where the widget would land if dropped now. |
| `previewColSpan` | `number \| null` | If the drop would resize the dragged widget, this is the new span. |
| `previewLayout` | `ComputedLayout \| null` | A full computed layout reflecting the tentative drop. Animate other widgets toward these positions for a live preview. |
| `isLongPressing` | `boolean` | Whether a touch long-press is in progress (before drag activation). |
| `longPressTargetId` | `string \| null` | Widget ID being long-pressed, or `null`. |

#### Refs, Drag Functions, and Utilities

| Name | Type | Description |
|------|------|-------------|
| `containerRef` | `Ref<HTMLDivElement>` | Attach to your grid container element. Used for width measurement and pointer coordinate mapping. |
| `measureRef` | `(id: string) => (node: HTMLElement \| null) => void` | Returns a callback ref for a widget. Attach to each widget's DOM node to enable height measurement. |
| `startDrag` | `(id, pointerId, initialPos, element, pointerType?) => void` | Call from a `pointerdown` handler to begin a drag. Respects position lock. |
| `updateDragPointer` | `(pos: { x: number; y: number }) => void` | Manually update the pointer position (advanced use). |
| `endDrag` | `() => void` | Programmatically cancel an active drag. |
| `getDragPosition` | `() => { x: number; y: number } \| null` | Returns the dragged widget's current position relative to the container, or `null` if not dragging. |
| `getA11yProps` | `(widgetId: string) => DragHandleA11yProps` | Get ARIA accessibility attributes for a drag handle. |
| `handleKeyboardDrag` | `(widgetId: string, e: React.KeyboardEvent) => void` | Handle keyboard events for keyboard-based dragging. Bind to the drag handle's `onKeyDown`. |
| `isWidgetLockActive` | `(id: string, lockType: LockType) => boolean` | Check whether a specific lock is active for a widget (considering both instance and definition locks). |
| `canAddWidget` | `() => boolean` | Check whether the maximum widget count has been reached. |
| `canUndo` | `boolean` | Whether an undo operation is available. |
| `canRedo` | `boolean` | Whether a redo operation is available. |
| `phase` | `"idle" \| "pending" \| "dragging" \| "keyboard-dragging" \| "dropping"` | Current drag engine phase. |

---

### Serialization

```ts
import {
  serializeDashboard,
  deserializeDashboard,
  validateSerializedDashboard,
  CURRENT_SERIALIZATION_VERSION,
} from "@nbotond20/editable-dashboard";
```

#### `serializeDashboard(state: DashboardState): SerializedDashboard`

Produces a compact JSON-safe snapshot. Strips transient `containerWidth` and omits optional fields that hold default values (e.g., `lockPosition: false` is omitted).

#### `deserializeDashboard(data: SerializedDashboard, definitions: WidgetDefinition[]): DashboardState`

Rebuilds a `DashboardState` from a snapshot with full validation:
- Validates all required fields and throws descriptive errors for invalid input
- Widgets whose `type` has no matching definition are silently dropped
- Duplicate widget IDs are deduplicated (first occurrence wins)
- `colSpan` values are clamped to `[1, maxColumns]`
- Supports schema version 1 (migrates `locked` to `lockPosition`) and version 2

#### `validateSerializedDashboard(data: unknown): { valid: boolean; errors: string[] }`

Validates the structure of serialized data without throwing. Use this to guard untrusted input before deserializing:

```ts
const raw = JSON.parse(userInput);
const { valid, errors } = validateSerializedDashboard(raw);
if (!valid) {
  console.error("Invalid dashboard data:", errors);
  return;
}
const restored = deserializeDashboard(raw, definitions);
```

#### `CURRENT_SERIALIZATION_VERSION`

The current schema version (currently `2`). Use for version checks or when building custom serialization.

```ts
// Save
const snapshot = serializeDashboard(state);
localStorage.setItem("dashboard", JSON.stringify(snapshot));

// Restore
const raw = JSON.parse(localStorage.getItem("dashboard")!);
const restored = deserializeDashboard(raw, definitions);
```

#### `SerializedDashboard`

| Field | Type | Description |
|-------|------|-------------|
| `version` | `number` | Schema version (currently `2`). |
| `widgets` | `WidgetState[]` | All widget instances. |
| `maxColumns` | `number` | Column count. |
| `gap` | `number` | Gap in pixels. |

---

### Standalone Layout Function

```ts
import { computeLayout } from "@nbotond20/editable-dashboard";
```

#### `computeLayout(widgets, heights, containerWidth, maxColumns, gap): ComputedLayout`

Run the layout algorithm outside of React (useful for server-side rendering, testing, or preview thumbnails).

| Parameter | Type | Description |
|-----------|------|-------------|
| `widgets` | `WidgetState[]` | The widget instances to lay out. |
| `heights` | `Map<string, number>` | Known heights for each widget ID. Missing entries default to `200`. |
| `containerWidth` | `number` | Container width in pixels. |
| `maxColumns` | `number` | Number of columns. |
| `gap` | `number` | Gap between widgets in pixels. |

Returns a `ComputedLayout` with `positions` and `totalHeight`.

---

## Types

### `WidgetDefinition`

Describes a category/type of widget available in the catalog.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `string` | -- | Unique identifier for this widget type. |
| `label` | `string` | -- | Human-readable display name. |
| `defaultColSpan` | `number` | -- | Default column span when adding a new instance. |
| `minColSpan` | `number?` | -- | Minimum allowed column span. |
| `maxColSpan` | `number?` | -- | Maximum allowed column span. |
| `lockPosition` | `boolean?` | `false` | When `true`, all instances are locked from being dragged by default. Overridable per-instance. |
| `lockResize` | `boolean?` | `false` | When `true`, all instances are locked from being resized by default. Overridable per-instance. |
| `lockRemove` | `boolean?` | `false` | When `true`, all instances are locked from being removed by default. Overridable per-instance. |

### `WidgetState`

Represents a single widget instance on the dashboard.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique instance ID (typically a UUID). |
| `type` | `string` | References a `WidgetDefinition.type`. |
| `colSpan` | `number` | Current column span. |
| `visible` | `boolean` | Whether the widget is visible on the grid. Set to `false` for soft-hide (retained in state but excluded from layout). Toggle with `showWidget`/`hideWidget` actions. |
| `order` | `number` | Sort order (lower values appear first). |
| `columnStart` | `number?` | Column hint -- forces the widget to start at a specific column. Set by column-shift drags; cleared on reorder. |
| `config` | `Record<string, unknown>?` | Arbitrary per-widget configuration. |
| `lockPosition` | `boolean?` | Per-instance position lock override. Takes precedence over definition. |
| `lockResize` | `boolean?` | Per-instance resize lock override. Takes precedence over definition. |
| `lockRemove` | `boolean?` | Per-instance remove lock override. Takes precedence over definition. |

### `DashboardStateInput`

The externally-facing state type used in controlled mode. Does not include transient fields.

| Field | Type | Description |
|-------|------|-------------|
| `widgets` | `WidgetState[]` | All widget instances. |
| `maxColumns` | `number` | Current column count. |
| `gap` | `number` | Gap in pixels. |

### `DashboardState`

Extends `DashboardStateInput` with transient runtime data.

| Field | Type | Description |
|-------|------|-------------|
| `widgets` | `WidgetState[]` | All widget instances. |
| `maxColumns` | `number` | Current column count. |
| `gap` | `number` | Gap in pixels. |
| `containerWidth` | `number` | Measured container width (transient, managed internally, not serialized). |

### `ComputedLayout`

| Field | Type | Description |
|-------|------|-------------|
| `positions` | `Map<string, WidgetLayout>` | Computed position and size for each visible widget. |
| `totalHeight` | `number` | Total height of the grid. |

### `WidgetLayout`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Widget ID. |
| `x` | `number` | Horizontal offset (px). |
| `y` | `number` | Vertical offset (px). |
| `width` | `number` | Computed width (px). |
| `height` | `number` | Measured or default height (px). |
| `colSpan` | `number` | Effective column span. |

### `DragState`

| Field | Type | Description |
|-------|------|-------------|
| `activeId` | `string \| null` | ID of the dragged widget. |
| `dropTargetIndex` | `number \| null` | Target insertion index. |
| `previewColSpan` | `number \| null` | Dragged widget's span in the preview (if resize is involved). |
| `previewLayout` | `ComputedLayout \| null` | Full layout for the tentative drop position. |

### `DropTarget`

| Field | Type | Description |
|-------|------|-------------|
| `targetIndex` | `number` | Insertion index in the visible-sorted list. |
| `previewColSpan` | `number \| null` | New column span for the dragged widget (or `null` if unchanged). |
| `affectedResizes` | `Array<{ id: string; colSpan: number }>` | Other widgets that would be resized. |
| `columnStart` | `number?` | Column hint for column-shift drops. |
| `swapWithId` | `string?` | ID of the widget to swap with (for cross-row swaps). |

### `DragHandleProps`

Props to spread onto a drag handle element.

| Field | Type | Description |
|-------|------|-------------|
| `onPointerDown` | `(e: ReactPointerEvent) => void` | Initiates the drag on pointer down. |
| `onKeyDown` | `(e: React.KeyboardEvent) => void` | Keyboard interaction handler. |
| `style` | `{ cursor: string; touchAction: string }` | Sets `cursor: grab/grabbing` and `touchAction: none`. |
| `role` | `'button'` | ARIA role. |
| `tabIndex` | `0` | Makes the handle focusable. |
| `aria-roledescription` | `'sortable'` | Accessibility description. |
| `aria-label` | `string` | Accessible label for the drag handle. |

### `WidgetSlotRenderProps`

Props passed to widget slot render functions.

| Field | Type | Description |
|-------|------|-------------|
| `widget` | `WidgetState` | The widget instance. |
| `dragHandleProps` | `DragHandleProps` | Spread these onto your drag handle. |
| `isDragging` | `boolean` | Whether this widget is actively being dragged. |
| `colSpan` | `number` | Current column span. |
| `resize` | `(colSpan: number) => void` | Resize this widget. |
| `remove` | `() => void` | Remove this widget. |

### `DashboardError`

Typed error object passed to the `onError` callback.

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | Machine-readable error code. |
| `message` | `string` | Human-readable description. |
| `context` | `Record<string, unknown>?` | Optional debugging context. |

**Error codes:**

| Code | When |
|------|------|
| `INVALID_DEFINITIONS` | Empty definitions array. |
| `DUPLICATE_DEFINITION_TYPE` | Two definitions share the same `type`. |
| `INVALID_DEFAULT_COL_SPAN` | A definition's `defaultColSpan` is less than 1. |
| `INVALID_MAX_COLUMNS` | `maxColumns` is 0 or negative. |
| `INVALID_GAP` | `gap` is negative. |
| `INVALID_MAX_UNDO_DEPTH` | `maxUndoDepth` is 0 or negative. |
| `INVALID_WIDGET_TYPE` | Attempted to add a widget with an unknown type. |
| `MAX_WIDGETS_REACHED` | Attempted to add a widget beyond `maxWidgets` limit. |
| `INVALID_COL_SPAN` | `resizeWidget` called with a span outside the valid range (clamped automatically). |
| `INVALID_REORDER_INDEX` | `reorderWidgets` called with out-of-bounds indices. |
| `INVALID_SERIALIZED_DATA` | Deserialization input fails structural validation. |

### `DragConfig`

Fine-tune drag activation, dwell timing, and scroll behavior.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `activationThreshold` | `number?` | `5` | Min pointer movement (px) before drag activates. |
| `touchActivationDelay` | `number?` | `200` | Touch long-press delay (ms). |
| `touchMoveTolerance` | `number?` | `10` | Max pointer drift (px) during long-press. |
| `autoScrollEdgeSize` | `number?` | `60` | Distance from viewport edge (px) to trigger auto-scroll. |
| `autoScrollMaxSpeed` | `number?` | `15` | Max auto-scroll speed (px/frame). |
| `swapDwellMs` | `number?` | `200` | Dwell time (ms) before cross-row swap activates. |
| `resizeDwellMs` | `number?` | `700` | Dwell time (ms) before auto-resize activates. |
| `dropAnimationDuration` | `number?` | `250` | Duration of the drop animation (ms). |

### `DashboardProviderProps`

See [`<DashboardProvider>` Props](#props) above.

### `DashboardContextValue`

The full shape returned by `useDashboard()`. See the [useDashboard()](#usedashboard) section.

### `DashboardAction`

The discriminated union of all reducer actions:

```ts
type DashboardAction =
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
  | { type: "SHOW_WIDGET"; id: string }
  | { type: "HIDE_WIDGET"; id: string }
  | { type: "UNDO" }
  | { type: "REDO" };
```

### `DashboardActions`

The memoized action dispatchers object. See the [actions table](#actions-dashboardactions).

---

## Constants

Exported default values and thresholds:

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_MAX_COLUMNS` | `2` | Default column count. |
| `DEFAULT_GAP` | `16` | Default gap in pixels. |
| `DEFAULT_WIDGET_HEIGHT` | `200` | Fallback height before measurement. |
| `DRAG_ACTIVATION_THRESHOLD` | `5` | Minimum pointer movement (px) before drag activates. |

---

## Layout Engine

### How Bin-Packing Works

The layout runs a greedy column-height algorithm:

1. Maintain an array of column heights (one per column), initialized to 0.
2. For each visible widget (sorted by `order`):
   - Compute the widget's effective `colSpan` (clamped to `[1, maxColumns]`).
   - Scan every valid start column. For each, the Y position is the maximum column height across the columns the widget would occupy.
   - Pick the start column with the lowest Y value (leftmost wins on ties).
   - If the widget has a `columnStart` hint, use that column instead.
   - Place the widget at `(x, y)` and update column heights.
3. `totalHeight` is the maximum column height minus one gap.

### Column Configuration

Set `maxColumns` on the provider or call `actions.setMaxColumns(n)` at runtime. When the column count decreases, widgets whose `colSpan` exceeds the new max are automatically clamped.

### Widget Sizing

Each widget's pixel width is calculated as:

```
width = colSpan * colWidth + (colSpan - 1) * gap
```

where:

```
colWidth = (containerWidth - gap * (maxColumns - 1)) / maxColumns
```

### Height Measurement

Widgets are measured automatically by a `ResizeObserver` attached via `measureRef`. The observer batches updates using `requestAnimationFrame` and only triggers a re-render when heights actually change. Before the first measurement, widgets use a fallback height of 200px.

---

## Drag & Drop

### Wiring Up Drag Handles

The simplest way to make a widget draggable:

```tsx
function MyWidget({ widget }: { widget: WidgetState }) {
  const { startDrag } = useDashboard();

  return (
    <div>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          startDrag(
            widget.id,
            e.pointerId,
            { x: e.clientX, y: e.clientY },
            e.currentTarget as HTMLElement
          );
        }}
        style={{ cursor: "grab", touchAction: "none" }}
      >
        Drag me
      </button>
      <div>Content here</div>
    </div>
  );
}
```

Key points:
- Call `e.preventDefault()` to stop text selection and default touch behaviors.
- Set `touchAction: "none"` on the handle for reliable pointer events on mobile.
- The drag activates only after the pointer moves at least 5px from the initial click.
- Press **Escape** at any time to cancel a drag.

### Drag Strategies

The drag system evaluates five families of drop candidates on every frame:

| Strategy | What It Does | When It Activates |
|----------|-------------|-------------------|
| **Insert** | Moves the widget to a new position; others shift to fill the gap. | Always (2+ widgets). |
| **Swap** | Exchanges positions of the dragged widget and a target in a different row. | Dragged and target are in different rows. |
| **Side-drop** | Resizes one peer and the dragged widget so they share a row. | Combined spans of the two widgets exceed `maxColumns`. |
| **Row squeeze** | Resizes all widgets in a row to make room for the dragged widget. | Multiple peers in the target row; combined spans overflow. |
| **Column shift** | Slides the widget to a different column within the same row (sets `columnStart`). | Always (keeps current order). |

The closest candidate to the pointer wins. Vertical distance is weighted 1.5x heavier than horizontal, so crossing rows requires deliberate movement. A **2-frame hysteresis** prevents the preview from flickering between candidates.

For detailed ASCII diagrams of every scenario, see [`docs/drag-behaviors.md`](./docs/drag-behaviors.md).

---

## Building Your Grid Component

Here is a step-by-step guide to building a custom animated grid using Framer Motion (`motion/react`):

### Step 1: The Grid Container

```tsx
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { useDashboard, type WidgetState } from "@nbotond20/editable-dashboard";

function DashboardGrid({ children }: {
  children: (widget: WidgetState, isDragging: boolean) => React.ReactNode;
}) {
  const { state, layout, dragState, containerRef } = useDashboard();

  const visibleWidgets = state.widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  // Use the preview layout during drag for smooth transitions
  const activeLayout = dragState.previewLayout ?? layout;

  return (
    <LayoutGroup>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          height: activeLayout.totalHeight || "auto",
          minHeight: 100,
        }}
      >
        {/* Drop ghost (shows where the widget will land) */}
        <AnimatePresence>
          {dragState.activeId && dragState.previewLayout && (() => {
            const ghostPos = dragState.previewLayout.positions.get(dragState.activeId!);
            if (!ghostPos) return null;
            return (
              <motion.div
                key="drop-ghost"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  x: ghostPos.x,
                  y: ghostPos.y,
                  width: ghostPos.width,
                  height: ghostPos.height,
                }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  borderRadius: 12,
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "2px dashed rgba(59, 130, 246, 0.3)",
                  pointerEvents: "none",
                }}
              />
            );
          })()}
        </AnimatePresence>

        {/* Widget slots */}
        <AnimatePresence mode="popLayout">
          {visibleWidgets.map((widget) => (
            <WidgetSlot key={widget.id} widget={widget}>
              {children}
            </WidgetSlot>
          ))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
```

### Step 2: The Widget Slot

```tsx
import { useCallback, useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "motion/react";
import { useDashboard, type WidgetState } from "@nbotond20/editable-dashboard";

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 };

function WidgetSlot({ widget, children }: {
  widget: WidgetState;
  children: (widget: WidgetState, isDragging: boolean) => React.ReactNode;
}) {
  const { layout, actions, dragState, getDragPosition, measureRef, startDrag } =
    useDashboard();

  const isDragging = dragState.activeId === widget.id;
  const isAnyDragging = dragState.activeId !== null;

  // During someone else's drag, use preview positions for smooth shifting
  const previewPos = dragState.previewLayout?.positions.get(widget.id);
  const normalPos = layout.positions.get(widget.id);
  const position = isAnyDragging && !isDragging && previewPos ? previewPos : normalPos;

  // Track the dragged widget's position with motion values for 60fps updates
  const motionX = useMotionValue(0);
  const motionY = useMotionValue(0);
  const rafId = useRef(0);

  useEffect(() => {
    if (!isDragging || !position) {
      cancelAnimationFrame(rafId.current);
      animate(motionX, 0, SPRING);
      animate(motionY, 0, SPRING);
      return;
    }
    const tick = () => {
      const dp = getDragPosition();
      if (dp && position) {
        motionX.set(dp.x - position.x);
        motionY.set(dp.y - position.y);
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [isDragging, position, getDragPosition, motionX, motionY]);

  if (!position) return null;

  return (
    <motion.div
      layout
      layoutId={widget.id}
      ref={measureRef(widget.id)}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: position.width,
        x: motionX,
        y: motionY,
      }}
      animate={{
        scale: isDragging ? 1.03 : 1,
        zIndex: isDragging ? 50 : 1,
        boxShadow: isDragging
          ? "0 20px 40px rgba(0,0,0,0.15)"
          : "0 0px 0px rgba(0,0,0,0)",
      }}
      transition={SPRING}
    >
      {children(widget, isDragging)}
    </motion.div>
  );
}
```

### Step 3: Plain CSS Alternative

If you prefer no animation library, use CSS transitions:

```tsx
function SimpleWidgetSlot({ widget }: { widget: WidgetState }) {
  const { layout, measureRef, startDrag } = useDashboard();
  const pos = layout.positions.get(widget.id);
  if (!pos) return null;

  return (
    <div
      ref={measureRef(widget.id)}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: pos.width,
        transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease",
      }}
    >
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          startDrag(widget.id, e.pointerId, { x: e.clientX, y: e.clientY }, e.currentTarget as HTMLElement);
        }}
        style={{ cursor: "grab", touchAction: "none" }}
      >
        Drag
      </button>
      <div>Your widget content</div>
    </div>
  );
}
```

---

## Advanced Usage

### Controlled Mode

For full control over state (useful for undo/redo, persistence, or syncing with a server):

```tsx
import { useState } from "react";
import {
  DashboardProvider,
  type DashboardStateInput,
  type WidgetDefinition,
} from "@nbotond20/editable-dashboard";

function App() {
  const [dashState, setDashState] = useState<DashboardStateInput>({
    widgets: [],
    maxColumns: 2,
    gap: 16,
  });

  return (
    <DashboardProvider
      definitions={definitions}
      state={dashState}
      onStateChange={setDashState}
    >
      <MyGrid />
    </DashboardProvider>
  );
}
```

Every action dispatched inside the provider will call `onStateChange` with the next state (without `containerWidth`, which is managed internally) instead of updating internal state.

### Batch Updates

Use `actions.batchUpdate(widgets)` to replace the entire widgets array in a single dispatch. This is used internally by the drag system for swaps and resizes but is also useful for bulk operations:

```tsx
// Hide all widgets at once
actions.batchUpdate(
  state.widgets.map((w) => ({ ...w, visible: false }))
);
```

### Dynamic Definitions

You can change the `definitions` array at any time. The provider will pick up the new definitions on the next render. This is useful for loading widget types dynamically:

```tsx
const [defs, setDefs] = useState<WidgetDefinition[]>(baseDefs);

// Later, add a new widget type
setDefs((prev) => [...prev, { type: "weather", label: "Weather", defaultColSpan: 1 }]);
```

### Widget Configuration

Store arbitrary per-widget settings using the `config` field:

```tsx
// Set config when adding
actions.addWidget("chart", 2, { chartType: "bar", timeRange: "7d" });

// Update config later
actions.updateWidgetConfig(widgetId, { timeRange: "30d" });

// Read config in your widget
function ChartWidget({ widget }: { widget: WidgetState }) {
  const chartType = (widget.config?.chartType as string) ?? "line";
  const timeRange = (widget.config?.timeRange as string) ?? "7d";
  // ...
}
```

### Responsive Columns

The library exports a `getResponsiveColumns()` utility that maps container width to a column count. You can customize the breakpoints via the `responsiveBreakpoints` prop:

```tsx
import { getResponsiveColumns } from "@nbotond20/editable-dashboard";

// Default breakpoints: <480px = 1 col, <768px = 2 cols, <1024px = 3 cols, >=1024px = 4 cols
const cols = getResponsiveColumns(containerWidth);

// Custom breakpoints
const cols = getResponsiveColumns(containerWidth, { sm: 400, md: 700, lg: 1200 });
```

Or wire it up with media queries for viewport-based responsiveness:

```tsx
import { useEffect, useState } from "react";

function useResponsiveColumns() {
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const mql3 = window.matchMedia("(min-width: 1024px)");
    const mql2 = window.matchMedia("(min-width: 640px)");

    const update = () => {
      if (mql3.matches) setCols(3);
      else if (mql2.matches) setCols(2);
      else setCols(1);
    };

    update();
    mql3.addEventListener("change", update);
    mql2.addEventListener("change", update);
    return () => {
      mql3.removeEventListener("change", update);
      mql2.removeEventListener("change", update);
    };
  }, []);

  return cols;
}

function App() {
  const cols = useResponsiveColumns();

  return (
    <DashboardProvider definitions={definitions} maxColumns={cols} gap={16}>
      <MyGrid />
    </DashboardProvider>
  );
}
```

### Persistence with localStorage

```tsx
import {
  DashboardProvider,
  serializeDashboard,
  deserializeDashboard,
  useDashboard,
  type DashboardState,
} from "@nbotond20/editable-dashboard";

function usePersistence() {
  const { state } = useDashboard();

  useEffect(() => {
    const snapshot = serializeDashboard(state);
    localStorage.setItem("my-dashboard", JSON.stringify(snapshot));
  }, [state]);
}

function App() {
  const saved = localStorage.getItem("my-dashboard");
  const initialState = saved
    ? deserializeDashboard(JSON.parse(saved), definitions)
    : undefined;

  return (
    <DashboardProvider
      definitions={definitions}
      initialWidgets={initialState?.widgets}
      maxColumns={initialState?.maxColumns ?? 2}
      gap={initialState?.gap ?? 16}
    >
      <PersistenceWatcher />
      <MyGrid />
    </DashboardProvider>
  );
}
```

---

## SSR Considerations

The layout engine relies on `ResizeObserver` to measure the container width and widget heights. Since `ResizeObserver` is not available during server-side rendering:

- **Container width** will be `0` on the server, resulting in an empty layout. Widgets will appear once the client hydrates and the `ResizeObserver` fires.
- **Widget heights** default to `200px` until measured on the client.

Recommended approaches:

1. **Dynamic import** the dashboard grid component so it only renders on the client.
2. Use a `useEffect`-based guard to defer rendering until the container has been measured.
3. Provide a placeholder or skeleton layout during SSR.

```tsx
import { lazy, Suspense } from "react";

const DashboardGrid = lazy(() => import("./DashboardGrid"));

function App() {
  return (
    <DashboardProvider definitions={definitions}>
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <DashboardGrid />
      </Suspense>
    </DashboardProvider>
  );
}
```

---

## Error Handling

The provider validates definitions, props, and actions at runtime. Invalid operations are either silently corrected (e.g., `colSpan` is clamped to valid range) or skipped (e.g., adding a widget with an unknown type). In both cases, the `onError` callback is fired with a typed `DashboardError`:

```tsx
<DashboardProvider
  definitions={definitions}
  onError={(err) => {
    // err.code: 'INVALID_WIDGET_TYPE' | 'MAX_WIDGETS_REACHED' | ...
    // err.message: human-readable description
    // err.context: optional debugging data
    console.error(`Dashboard error [${err.code}]:`, err.message);
    sendToErrorTracking(err);
  }}
>
  <MyGrid />
</DashboardProvider>
```

In development (`process.env.NODE_ENV !== 'production'`), validation errors also emit `console.warn` for visibility during development.

**What is validated:**
- `definitions` array: non-empty, unique types, valid `defaultColSpan`
- Provider props: `maxColumns > 0`, `gap >= 0`, `maxUndoDepth > 0`
- `initialWidgets`: widgets referencing unknown types are filtered out
- `addWidget`: widget type must exist in definitions; `maxWidgets` limit enforced
- `resizeWidget`: `colSpan` clamped to definition's `[minColSpan, maxColSpan]` range
- `reorderWidgets`: indices validated against visible widget count

---

## Lifecycle Callbacks

The provider exposes optional callbacks for observing drag events and widget mutations. These fire *after* the state has been updated.

### Drag Callbacks

```tsx
<DashboardProvider
  definitions={definitions}
  onDragStart={({ widgetId, phase }) => {
    // phase: 'pointer' (mouse/touch) or 'keyboard'
    analytics.track("drag_start", { widgetId, phase });
  }}
  onDragEnd={({ widgetId, operation, cancelled }) => {
    // operation: the CommittedOperation (reorder, swap, auto-resize, etc.)
    // cancelled: true if Escape was pressed or drag was aborted
    if (!cancelled) saveToServer(state);
  }}
>
```

### Widget Mutation Callbacks

```tsx
<DashboardProvider
  definitions={definitions}
  onWidgetAdd={({ widget }) => console.log("Added:", widget.id)}
  onWidgetRemove={({ widgetId }) => console.log("Removed:", widgetId)}
  onWidgetResize={({ widgetId, previousColSpan, newColSpan }) => {
    console.log(`Resized ${widgetId}: ${previousColSpan} → ${newColSpan}`);
  }}
  onWidgetReorder={({ widgetId, fromIndex, toIndex }) => {
    console.log(`Reordered ${widgetId}: ${fromIndex} → ${toIndex}`);
  }}
  onWidgetConfigChange={({ widgetId, config }) => {
    console.log(`Config changed for ${widgetId}:`, config);
  }}
>
```

### State Observation

The `onChange` callback fires on every state change in **both** controlled and uncontrolled modes:

```tsx
<DashboardProvider
  definitions={definitions}
  onChange={(state) => {
    // Fires after every action in either mode
    localStorage.setItem("dashboard", JSON.stringify(serializeDashboard(state)));
  }}
>
```

> **Note:** In controlled mode, `onStateChange` emits `DashboardStateInput` (without `containerWidth`), while `onChange` emits the full `DashboardState` (with `containerWidth`).

---

## Widget Visibility

Use `showWidget` and `hideWidget` to soft-hide widgets without removing them from state:

```tsx
const { actions } = useDashboard();

// Hide a widget (removed from layout but retained in state)
actions.hideWidget(widgetId);

// Show it again
actions.showWidget(widgetId);
```

Both actions participate in undo/redo. A hidden widget (`visible: false`) is excluded from the layout but remains in `state.widgets`. Use `removeWidget` to permanently delete a widget.

---

## Configuring Drag Behavior

Pass a `dragConfig` prop to tune the drag system:

```tsx
<DashboardProvider
  definitions={definitions}
  dragConfig={{
    activationThreshold: 8,     // Require 8px movement before drag (default: 5)
    touchActivationDelay: 300,  // Longer touch hold for accessibility (default: 200)
    swapDwellMs: 400,           // Slower swap activation (default: 200)
    resizeDwellMs: 1000,        // Slower auto-resize (default: 700)
    autoScrollEdgeSize: 80,     // Larger scroll trigger zone (default: 60)
    autoScrollMaxSpeed: 20,     // Faster scroll (default: 15)
    dropAnimationDuration: 400, // Slower drop animation (default: 250)
  }}
>
```

All fields are optional. Omitted fields use the defaults from the library's constants.

---

## Advanced: Engine Subpath

For power users who need access to the drag engine internals, undo history utilities, or internal hooks, use the `/engine` subpath:

```ts
import {
  DragEngine,
  useAutoScroll,
  useDragAnnouncements,
  createUndoHistory,
  pushState,
  undo,
  redo,
  canUndo,
  canRedo,
  type EngineDragEvent,
  type DragPhase,
  type DragEngineConfig,
  type UndoHistory,
} from "@nbotond20/editable-dashboard/engine";
```

This subpath re-exports everything from the main entry plus the advanced APIs. Use this when building custom React integrations, non-React wrappers, or for direct engine control.

---

## TypeScript

The library is written in TypeScript and exports all types. Key types to import:

```ts
import type {
  LockType,
  WidgetDefinition,
  WidgetState,
  DashboardState,
  DashboardStateInput,
  DashboardError,
  DragConfig,
  CommittedOperation,
  WidgetLayout,
  ComputedLayout,
  DragState,
  DropTarget,
  DashboardAction,
  DashboardActions,
  DragHandleA11yProps,
  DragHandleProps,
  WidgetSlotRenderProps,
  DashboardProviderProps,
  DashboardContextValue,
  SerializedDashboard,
  ResponsiveBreakpoints,
} from "@nbotond20/editable-dashboard";
```

All action dispatchers, refs, and the hook return type are fully typed. No `any` types are used.

---

## Demo App

The repository includes a full demo app in `src/app/` that showcases:

- Uncontrolled provider with initial widgets
- Custom grid built with Framer Motion (`motion/react`)
- Animated widget slots with drag previews and drop ghosts
- Widget catalog for adding new widgets
- Column count switching (1/2/3)
- Per-widget resize controls
- Hide/show and remove actions

Run it locally:

```bash
pnpm install
pnpm dev
```

---

## License

MIT
