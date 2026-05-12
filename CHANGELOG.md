# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New `deferred-swap` `OperationIntent` variant and `swapTargetId: string | null` field on `DragState`. In `lines` / `both` modes, hovering directly over a widget surfaces a deferred-swap intent that highlights the target without reflowing the layout; the swap commits as a regular `SWAP_WIDGETS` operation only on drop. Classic mode keeps the existing immediate (dwell-based) swap.
- New `dropMode` config (`'classic' | 'lines' | 'both'`, default `'classic'`), `lineSnapRadius` (default `16`), and `lineCornerInset` (default `8`) on `DragConfig`.
- New `InsertionLine` engine type and `insertionLines: InsertionLine[]` field on `DragEngineSnapshot`.
- New `useInsertionLines()` React hook for consumer-rendered drop indicators.
- New `sourceGhost: WidgetLayout | null` field on `DragState` and matching `useSourceGhost()` React hook — exposes the pre-drag layout of the dragged widget so consumers can render a headless "source ghost" placeholder at the slot it was picked up from. Populated only during a pointer drag while `dropMode` is `'lines'` or `'both'`; `null` otherwise. The demo app renders it as a solid-bordered outline matching the original widget's size and border radius.
- New `OperationIntent` / `CommittedOperation` variants: `new-row` (drop on H-line) and `in-row-insert` (drop on V-line with equal-distribute resize fallback).
- E2E coverage: `insertion-lines-render`, `insertion-lines-magnetic`, `insertion-lines-h-drop`, `insertion-lines-v-drop`, `insertion-lines-edge-cases`, `insertion-lines-modes`.
- Unit coverage: `equal-distribute`, `insertion-lines` (`computeInsertionLines`, `findSnappedLine`), `zone-resolver-lines`, `intent-resolver-lines`, `operation-applier-lines`, `zones-equal-lines`.

### Changed

- `computeInsertionLines` now accepts an optional `getWidgetConstraints` input. Lines mode now uniformly respects the same locks and constraints as classic mode: position locks, resize locks (source and stationaries), and `minSpan` / `maxSpan` from `getWidgetConstraints`.
- `equalDistribute` now also enforces `isResizeLocked` on the source widget (previously skipped) — in-row inserts no longer silently shrink a resize-locked source.

### Fixed

- Insertion lines are now greyed out (`disabled: true`) when the drop is infeasible: any V-line where equal-distribute would violate a stationary's resize-lock, the source's resize-lock, or a `minSpan` / `maxSpan` constraint; any line whose reorder would shift a position-locked widget across the source's original position; and H-lines where the source is resize-locked but its current span exceeds `maxColumns` or constraint bounds.
- `insertion-line-h` `new-row` intent now keeps the source's current `colSpan` when the source is resize-locked instead of forcing it to `min(maxColumns, maxSpan)`. Returns `none` when the locked span doesn't fit.
- `insertion-line-h` / `insertion-line-v` zones now return `none` when reordering would cross a position-locked widget (matching the existing `gap` behavior).
- Column-pin no longer shrinks the source widget instantly when the pinned column can't accommodate its full `colSpan`. The shrink now waits for `resizeDwellMs` (matching other resize-style operations). If the source is `isResizeLocked`, column-pin to a too-narrow column is suppressed entirely.
- Outer insertion lines no longer sit flush against widget edges. Outer-left/outer-right V-lines are now offset half-gap outward from the adjacent widget (no longer clamped to container bounds), matching the half-gap geometry of inner V-lines and existing H-lines.
- Horizontal insertion lines now span only the row's widget extent instead of the full container width, so they visually align with the row above/below rather than running edge-to-edge.
- Insertion line endpoints are inset by `lineCornerInset` pixels (default `8`) so the lines no longer overlap widget rounded corners on the top/bottom (V-lines) and left/right (H-lines).
- H-lines and V-lines no longer falsely disable based on the insertion-index coincidentally matching the source's array position. H-lines now disable only when the source was alone in its row at full width and the line is immediately adjacent to that row (so dropping a shared-row widget on the H-line just above/below another row is enabled, since the resulting full-width new row differs from the source's current placement). The rightmost V-line of a row now anchors its insertion index to the last non-source widget in that row (+1) instead of falling back to the end of the global widget list, so dropping into a single-widget row's right side correctly inserts after that widget and the line is no longer flagged self-adjacent-by-order.
- V-line self-adjacency check now also requires the source's current `colSpan` to fit in the target row without overflow. When source's span overflows the target row (e.g. dragging a full-width widget from row N to a row above with free space), the line is no longer disabled — equal-distribute resize fires and places the source into the target row at a smaller span.
- Horizontal insertion lines no longer cross widgets when row heights differ. H-lines are now rendered as per-widget (top/bottom of the dashboard) and per-column-gap (between rows) segments anchored to widget edges with `lineCornerInset`, so the indicators always sit in the gap and never overlay a widget body. `InsertionLine` gained an optional `segments` array carrying the per-segment endpoints; existing `x1/y1/x2/y2` fields are preserved as a bounding box for backwards compatibility.
- Insertion lines now render around every widget — including the dragged source — at exactly half-gap distance on all four sides. Mid-row H-lines emit per-widget top/bottom segments (instead of column-overlap segments) and surrounding lines for the dragged widget are emitted as disabled so the rhythm stays consistent.
- Insertion line segments are now anchored to a specific widget (`anchorId` + `edge` on `InsertionLineSegment`) and rendered inside the anchor widget's animated container, so lines follow the widget's transform during layout shifts instead of staying at frozen placement coordinates. Vertical line segments are sized to the anchor widget's height (no longer the row's union of heights), so they no longer overshoot shorter widgets. Vertical lines now always emit `segments` (previously only horizontal lines did).
- Ghost preview is now shown during drag in `lines` / `both` modes (previously suppressed). Hover-over-widget swaps and other intents now produce a visible preview layout instead of leaving the layout frozen.

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
