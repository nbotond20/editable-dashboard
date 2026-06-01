# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `useEmptySlots()` hook — exposes free column regions (per-row trailing space and an empty dashboard) as `EmptySlot[]` for rendering "add widget" affordances.
- `useInvalidTarget()` hook and `DragState.invalidTarget` (`InvalidDropTarget`) — the would-be footprint and typed reason when a lines-mode drop is infeasible. `InvalidDropTarget` also carries the originating insertion location (`orientation`, `beforeId`, `afterId`).
- `useEmptySlotDragState()` hook, `EmptySlotDragState` type and `DragState.emptySlotDragState` — live `valid` / `invalid` (with reason) feedback for the empty slot the dragged widget currently covers, computed across the slot's whole area (not just within snap range of its edge line), plus `EmptySlot.anchorId`, so an "add widget" affordance can stay mounted and recolor in place during a drag.
- `InsertionInvalidReason` type (`position-locked` | `only-full-width` | `resize-locked` | `column-overflow`) and `InsertionLine.disabledReason`, populated for genuinely-infeasible lines.
- `InsertionLine.invalidActive` — marks the infeasible line nearest the pointer so consumers can render a "cannot drop here" marker.
- `actions.addWidget(type, colSpan?, config?, placement?)` — optional `placement: { targetIndex, columnStart }` to add a widget at a specific position (e.g. into a clicked empty slot) instead of appending.
- `EmptySlot` type and `containerWidth` on the stable context / engine snapshot.

### Changed

- Lines-mode `previewLayout` now reflects the committed result for `new-row` and `in-row-insert` intents — the dragged widget is positioned at its destination slot, enabling a headless placement preview and drag-preview resizing.
- Drag feasibility now respects `WidgetDefinition.minColSpan` / `maxColSpan` (previously only enforced on the resize action). A widget whose `minColSpan` equals the column count reports `only-full-width` when it cannot share a row.
- A row's trailing free space is now a full drop target during a lines-mode drag: hovering the dragged widget anywhere over an empty slot resolves to that row's trailing-edge insertion line.
- Demo: widget width toggles now only render the spans a widget can actually take (`minColSpan`…`maxColSpan` clamped to the column count) and are hidden entirely when only one width is possible (e.g. a full-width-only banner).

### Fixed

- `useEmptySlotDragState()` now follows the pointer, not only the dragged widget's footprint centre. Dragging a wide widget (e.g. a full-width-only banner) by its edge handle so the cursor — but not the widget's centre — is over an empty slot now recolors that slot (`valid` / `invalid` with reason) instead of leaving it blank.
- `useEmptySlots()` no longer positions a slot so it overlaps an adjacent-column widget. A slot's vertical extent now both starts below any widget protruding from above into its free columns and ends above any widget below it in those columns (e.g. a full-width widget under a partially-filled row), so the "add widget" affordance never overlaps a neighbour (masonry layouts).
- Infeasible lines-mode drops no longer render a footprint box that overlaps a widget. Feedback is a thin marker on the widget's side via `InsertionLine.invalidActive` (and the empty slot recolors with its reason). `DragState.invalidTarget` is unchanged for consumers that still want the footprint.
- Horizontal insertion line directly above a source that is alone in its row no longer collapses its insertion index to the end of the list. Dropping such a widget (e.g. `A` / `B` / `C C`, dragging `B` onto the line under `A`) now places it full-width at that gap instead of jumping it to the bottom, and the placement preview renders in the correct row.
- Demo: the insertion-line end cap (circle-plus marker) and active line now stack below the dragged widget instead of painting on top of it during a lines-mode drag.
- Dropping a dragged widget onto a lower row's trailing empty slot now places it beside that row's last widget, leaving the cell above it empty, instead of compacting the widget back into the free top band of its column or scrambling the row order. Because masonry can't hold a widget in a lower row with empty space above it in the same column, the source (and its new row-mates) are pinned via `rowStart` so the gap is preserved; the placement preview and committed layout now agree. (e.g. `A B` / `C`, dragging `B` onto `C`'s trailing slot, yields `A ·` / `C B`.) The pin is transient — a later drag of any widget recompacts the row, consistent with the no-persistent-holes runtime model.
- Lines-mode placement preview no longer detaches the active insertion line and source ghost when the dragged widget is taller than its row-mate. Dropping such a widget as a new row (e.g. `A B` / `C C` with `A` shorter than `B`, dragging `B` onto the line above `C`) used to leave the active line floating inside the placement ghost and the source ghost overlapping it, because both stayed anchored to the pre-drag layout while the rest reflowed. The active line now tracks the previewed drop slot's leading edge, and the source ghost is hidden while it would overlap the placement ghost.
- Demo: the empty "add a widget" slot now grows to the dragged widget's height while it is a valid drop target, so the affordance previews the footprint the widget will occupy instead of staying pinned to the (shorter) host row's height.
- Classic-mode drag zone resolution now uses the pointer position rather than the dragged widget's recentred centre, matching lines mode. Grabbing a wide widget by an off-centre handle and hovering a target's edge previously offset the resolved zone by `(width/2 − grabOffset)`, so an edge-targeted swap/auto-resize could overshoot into the neighbouring widget (e.g. holding the cursor on `A`'s right edge swapped with `B`). The drop now follows the cursor.

## [5.0.2] - 2026-05-12
## [5.0.1] - 2026-05-12
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
