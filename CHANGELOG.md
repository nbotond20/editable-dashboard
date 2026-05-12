# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `useAnchoredInsertionSegments(widgetId)` hook — returns the segments anchored to a single widget via a shared O(1) lookup, replacing per-widget filtering of the full lines array.

### Changed

- Insertion lines: `computeInsertionLines` result is now memoized inside the engine by layout / widgets / source identity; recomputed only on real input changes instead of every pointer move.
- Insertion lines: exposed `insertionLines` array preserves referential identity when neither the raw lines nor the active line changed, avoiding unnecessary React re-renders during drag.
- `findSnappedLine` and `filterLinesByProximity` short-circuit lines outside the pointer's bounding box.
- `computeInsertionLines` internals: O(1) excluded-widget index lookups, single-pass bounding-box math (no `Math.min(...spread)`), memoized `hLineFeasible`, and deduplicated source-widget lookups.
## [4.4.2] - 2026-04-21
## [4.4.1] - 2026-04-21
## [4.4.0] - 2026-04-19
## [4.3.1] - 2026-04-13
## [4.3.0] - 2026-04-09
## [4.2.0] - 2026-04-07
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
