# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Auto-scroll during drag near viewport edges with configurable edge size and max speed
- Long-press visual feedback and body lock during touch drag
- Same-row swap stabilization to prevent uninvolved widgets from shifting during swaps
- Auto-resize fallback when side-drop produces a degenerate layout
- `setupDashboardRaw` test utility for precise widget configuration and state reproduction
- `dragConfig` prop for fine-tuning activation thresholds, dwell times, scroll speed, and animation duration

### Changed

- Drag engine now uses zone-to-intent state machine with dwell-based intent resolution
- Improved intent resolver to fall back to swap when auto-resize is degenerate
- WidgetSlot animation uses dynamic width with improved spring transitions

### Fixed

- Environment check for dashboard error logging now uses `import.meta.env.DEV`
- Drag engine intent handling edge cases for auto-resize operations

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
