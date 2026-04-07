# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **External drag-to-add**: drag widgets from an external source (side panel, toolbar) onto the dashboard grid to add new widgets
  - `useExternalDragSource(widgetType, options?)` hook — returns `draggable`, `onDragStart`, `onDragEnd` props for any element
  - `enableExternalDrag` prop on `DashboardProvider` to opt in
  - Uses HTML5 Drag and Drop for cross-component communication with document-level listeners to work through overlays and backdrops
  - Module-scoped registry (`external-drag-registry.ts`) to pass drag data between source and target, avoiding the `getData()` restriction on `dragover` events
  - Custom MIME type (`application/x-dashboard-widget`) identifies dashboard widget drags
  - `onDragStart` / `onDragEnd` callbacks on the hook for consumer lifecycle handling (e.g., hiding a catalog panel during drag)
- **Positional widget insertion**: `ADD_WIDGET` reducer action now accepts optional `targetIndex` and `columnStart` to insert at a specific position instead of appending
- **Headless trash zone**: opt-in drop zone for removing widgets or cancelling external adds during drag
  - `useTrashZone()` hook — returns `ref`, `isActive`, `isOver` for fully consumer-controlled UI
  - Works with both internal pointer drags (tracks pointer position vs element rect) and external HTML5 drags (dragenter/dragleave on the element)
  - Engine-level `getTrashRect` config: on internal drag drop, if pointer is over trash, widget is removed instead of reordered
  - New `trash` committed operation type
- **Unified ghost rendering**: external drag ghost now uses the same CSS class and rendering path as internal drag ghost (`EXTERNAL_PHANTOM_ID` in the preview layout)
- **Layout shift during external drag**: existing widgets reflow to make room for the incoming widget, matching internal drag behavior
- New exports: `useExternalDragSource`, `useTrashZone`, `EXTERNAL_PHANTOM_ID`, `ExternalDragItem`, `ExternalDragSourceProps`, `ExternalDropEvent`
- `DragState` extended with `isExternalDrag` and `externalWidgetType` fields
- `DashboardDragContextValue.phase` now includes `"external-dragging"`
- `registerTrashZone` on `DashboardStableContextValue` for trash zone element registration
- Empty-row dwell-to-maximize: dragging a shrunk widget into an empty row and holding for 600ms automatically maximizes it to full width
- New `emptyRowMaximizeDwellMs` config option on `DragEngineConfig` to control the dwell threshold (default: 600ms)
- New `empty-row-maximize` operation intent and committed operation types
- E2E tests for the maximize-on-dwell feature (cases 86-88)

### Changed

- `resolveZone()` now accepts `sourceId: string | null` — when `null`, no widget is excluded from hit testing (used by external drags)
- External drag colSpan on drop now matches the preview ghost exactly, respecting column-pin constraints and empty-row-maximize sizing

### Fixed

- Fixed pre-existing type error in `intent-resolver.test.ts` (missing `emptyRowMaximizeDwellMs` and `isResizeLocked` in test config)

## [4.1.0] - 2026-04-06
## [4.0.0] - 2026-04-06
## [3.0.2] - 2026-04-06
## [3.0.1] - 2026-04-04
## [3.0.0] - 2026-04-04
## [2.0.0] - 2026-04-04
## [1.0.0] - 2026-04-04
## [0.1.0] - 2026-03-28

### Added

- `DashboardProvider` component with controlled and uncontrolled modes
- `useDashboard` hook exposing state, layout, actions, drag state, and refs
- Bin-packing layout engine (`computeLayout`) with masonry-style column filling
- 5 intelligent drag strategies: insert, swap, side-drop, row squeeze, column shift
- Pointer-based drag system with mouse and touch support
- Keyboard drag navigation (arrow keys to move, Shift+arrows to resize)
- Widget locking system with three lock types: position, resize, remove
- Lock inheritance from definition defaults with per-instance overrides
- Built-in undo/redo with configurable depth and `Ctrl+Z` / `Ctrl+Y` shortcuts
- Serialization and deserialization with schema versioning (v1 and v2)
- Auto-measuring widget heights via `ResizeObserver`
- Auto-scroll during drag near viewport edges
- Screen reader announcements for drag operations via live region
- Responsive column helper (`getResponsiveColumns`)
- Custom drop validation via `canDrop` prop
- Per-widget configuration storage (`config` field)
- Full TypeScript type exports
- `@nbotond20/editable-dashboard/engine` subpath for advanced internals
