# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Randomized drag test system: generates 50+ random scenarios per run, predicts outcomes via independent rule-based state calculator, runs through Playwright, persists passing/failing tests to a permanent suite with deduplication
- Rule-based state machine (`e2e/randomized/rules.ts`) with atomic, composable rules for swap, auto-resize, column-pin, and blocked drag operations
- Version info display in demo app header (version, commits since release, git hash)
- `intentType` field on `DragState` exposing the current drag operation intent type

### Fixed

- Ghost preview now appears when hovering over the widget's original position during drag
- Widget expands to fill its own empty row after 600ms dwell during drag

### Changed

- E2E tests: reorganized drag, touch, and lock tests with data-driven scenario runner (`defineScenarios`), merged duplicate describe blocks by layout, removed 3 duplicate test cases, consolidated lock tests into 3 groups
- Widget width now animates smoothly on colSpan changes (grow/shrink) but snaps instantly on position changes
- Ghost fades in at the correct position instead of animating from the origin

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
