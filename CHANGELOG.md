# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 4.0.0

### Breaking Changes

- **`DashboardStateInput` simplified** -- Now `{ widgets: WidgetState[] }` only. `maxColumns` and `gap` are no longer part of the controlled state; they are always top-level provider props.
- **`onStateChange` signature changed** -- Controlled mode callback is now `(widgets: WidgetState[]) => void` instead of `(state: DashboardStateInput) => void`.
- **`DashboardState` no longer extends `DashboardStateInput`** -- It is a standalone interface with `widgets`, `maxColumns`, `gap`, and `containerWidth`.
- **`SET_CONTAINER_WIDTH` action removed** -- This action was dead code; the engine manages `containerWidth` via direct mutation through `send()`. Removed from `DashboardAction` union and the reducer.

### Fixed

- **Controlled mode: drag operations now persist** -- Previously, drag & drop results were silently reverted because the engine bypassed `onStateChange`. All state mutations (actions, drag, undo/redo) now flow through a single `onCommit` channel.
- **Controlled mode: undo/redo now works** -- `replaceState` no longer destroys the undo history on every render. The engine preserves its undo stack across controlled state syncs.
- **Controlled mode: `replaceState` no longer pollutes undo history** -- External state replacements now update the present state without pushing to the undo stack.
- **Render-phase side effect removed** -- `replaceState` moved from render to `useLayoutEffect` with a proper dependency array, fixing a React rules-of-hooks violation and eliminating redundant calls on every render.
- **Keyboard undo/redo now routes through dispatch** -- `useUndoRedoShortcuts` uses the dispatch bridge instead of calling `engine.dispatch` directly, ensuring consistent behavior in both modes.
- **Drag mutation callbacks now fire** -- `onWidgetReorder`, `onWidgetResize`, etc. now fire for drag-committed operations (reorder, swap, auto-resize, resize-toggle, column-pin), not just programmatic actions.
- **`UPDATE_WIDGET_CONFIG` and `SET_WIDGET_LOCK` are now undoable** -- Both actions were missing from the undoable set, so config and lock changes could not be undone with Ctrl+Z.
- **`reorderWidgets(i, i)` no longer creates empty undo entry** -- Calling `reorderWidgets` with identical from/to indices now returns early instead of pushing a no-op to the undo stack.
- **`normalizeOrder` no longer interleaves hidden widgets** -- Hidden widgets are now consistently ordered after all visible widgets, matching the documented behavior.
- **`SET_MAX_COLUMNS` now clamps invalid `columnStart` values** -- Reducing the column count clears `columnStart` on any widget whose pin would exceed the new grid bounds.
- **Multiple dashboard instances no longer share global state** -- `useAutoScroll` cache variables moved from module scope to per-instance refs; `useDragAnnouncements` live region ID is now unique per instance via `useId()`.
- **Unmount during drag no longer leaves engine in active state** -- `engine.destroy()` now cancels any active drag before clearing listeners. `DashboardProvider` calls `destroy()` on unmount.

### Added

- `CommitSource` type -- Describes what caused a state commit (`action`, `drag-operation`, `undo`, `redo`). Exported from the public API.
- `onCommit` callback on `DragEngineConfig` -- Optional hook called for every state mutation inside the engine. Used by the React layer to bridge controlled mode and fire drag mutation callbacks.
- `maxUndoDepth` on `DragEngineConfig` -- Configurable undo stack depth (previously hardcoded to 50).
- Dev-mode warning when switching between controlled and uncontrolled mode mid-lifecycle.

### Changed

- `useDispatch` simplified to a single code path -- Always delegates to `engine.dispatch`. The controlled/uncontrolled branching is handled inside the engine via `onCommit`.
- `useMutationCallbacks` returns `{ fireMutationCallbacks, fireDragCommitCallbacks }` instead of a single function.

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
