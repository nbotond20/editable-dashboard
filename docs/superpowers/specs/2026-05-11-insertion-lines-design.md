# Insertion Lines — Design Spec

**Status:** draft — pending implementation
**Date:** 2026-05-11
**Owner:** @nbotond20
**Scope:** headless `editable-dashboard` library + demo

## 1. Goal

Add a new drop-position interaction model on top of the existing drag engine:

- While dragging, **magnetic insertion lines** appear in the grid.
- **Vertical lines** flank widgets in a row (left of first, right of last, midpoint of each inter-widget gap). Dropping on a V-line inserts the source into that row, equal-distributing column spans if the row would overflow.
- **Horizontal lines** sit above the first row, below the last row, and between every adjacent row pair. Dropping on an H-line places the source as a full-width new row at that position.
- **Swap-on-widget-center** keeps working in every mode — dropping inside a widget's bounds always means "swap with that widget".

The whole system stays **headless**: the engine emits line geometry + state, the React adapter exposes it on the drag snapshot, and the demo (not the library) renders the actual line elements.

## 2. Non-goals

- No change to existing operations in `dropMode: 'classic'`. Every existing e2e test must keep passing with default config.
- No new UI components inside the library. Lines are rendered by the consumer (or by the demo for the playground).
- No keyboard-driven line interaction in v1. Keyboard drag keeps its current state machine; lines only appear during pointer-drag.
- No new accessibility announcement schema in v1 (re-use existing `useDragAnnouncements`).
- No animation API in v1. Library exposes data only; demo handles motion.

## 3. Mode definitions

A new `dropMode: 'classic' | 'lines' | 'both'` prop on `DashboardProvider`. Default `'classic'`.

| Mode | Swap on widget center | Lines emitted | Classic resolver runs | Dead-space drop |
|---|---|---|---|---|
| `'classic'` | yes (existing dwell) | no | yes | classic result (today's behavior) |
| `'lines'` | yes (universal) | yes | only for widget-center hits | cancel |
| `'both'` | yes (universal) | yes | when pointer is outside every line's snap radius | classic result |

### 3.1 Arbitration in `'both'`

For each pointer move, the zone resolver:

1. Builds the candidate `InsertionLine[]` (filtered/flagged by source/locks per §4.3).
2. If any **enabled** line has the pointer within `lineSnapRadius`, that line wins → zone is `insertion-line-h` or `insertion-line-v`.
3. Otherwise the classic resolver runs (returns `gap`, `widget`, `empty`, or `outside`).

Swap on widget center is therefore reachable in every mode: dropping inside a widget's interior (not within any line's snap radius) yields a `widget` zone, which the existing intent resolver converts to swap.

### 3.2 Arbitration in `'lines'`

Same as `'both'` for line vs widget. The difference: when the classic resolver would have returned `gap`, `empty`, or `outside`, the result is collapsed to `outside`. Releasing the pointer there cancels the drag.

## 4. Line topology

### 4.1 Vertical lines

For each row of the **source-excluded layout** (i.e., the layout that would render if the source weren't there — same model already used by the engine for previews), let `[w1, …, wN]` be the row's stationary widgets ordered left-to-right. V-lines are emitted at:

- `x = first.x` (outer-left)
- `x = (prev.x + prev.width + next.x) / 2` for each adjacent pair (gap midpoint)
- `x = last.x + last.width` (outer-right)

The line's `y1, y2` span the row: `y1 = min(wi.y)`, `y2 = max(wi.y + wi.height)`.

**Source-only row** (source was the only widget in a row): after exclusion the row vanishes; no V-lines for that row. The H-lines above/below the source's removed row collapse into a single H-line at that vertical position.

**1-column mode (`maxColumns === 1`)**: no V-lines emitted. In-row insertion is undefined when rows hold only one widget.

### 4.2 Horizontal lines

Let `rows = [R0, R1, …, RM]` be the row partition of stationaries (source excluded). H-lines emitted at:

- Above `R0`: `y = R0.top - gap/2` (or `y = -gap/2` if `R0.top == 0`)
- Between `Ri` and `Ri+1`: `y = (Ri.bottom + Ri+1.top) / 2`
- Below `RM`: `y = RM.bottom + gap/2`

`x1 = 0`, `x2 = containerWidth` for every H-line (full width — matches "full-width new row").

**Empty dashboard** (M = 0): one H-line emitted at `y = gap/2`. External drag targets it; internal drag is impossible (nothing to drag).

### 4.3 Disabled lines

A line is emitted but flagged `disabled: true` (rendered greyed-out / inactive in UI, drop cancels) when:

- **Self-adjacent** for the source widget. Concretely:
  - V-line whose `targetId === sourceId` and `side === "left"` (i.e. drop at left edge of source — same position)
  - V-line whose `targetId === sourceId` and `side === "right"` (same position)
  - V-line that sits immediately left of source's current slot (drop here = source stays put)
  - V-line that sits immediately right of source's current slot (same)
  - H-line directly above source's row if source is the only widget in that row (drop = no-op)
  - H-line directly below source's row if source is the only widget in that row (same)
- **Resize-lock conflict**: equal-distribute resize (see §6) would require shrinking a `resize`-locked stationary below its current span. Only that specific V-line is disabled.
- **Source position-locked**: source has `position` lock → drag is no-op by existing rules; no lines emitted at all (engine short-circuits before line computation).

`isActive` and `disabled` are independent: a disabled line never becomes `isActive` (snap radius check skips disabled lines).

## 5. Engine API additions

All types live alongside existing ones in `src/lib/dashboard/engine/types.ts` (and re-exported from `engine-entry.ts`).

### 5.1 New types

```ts
export type InsertionLine = {
  id: string;                                // stable id: `${orient}-${beforeId ?? "start"}-${afterId ?? "end"}-${rowIndex ?? ""}`
  orientation: "horizontal" | "vertical";
  x1: number; y1: number; x2: number; y2: number;
  insertionIndex: number;                    // widgets-array index this line drops into
  beforeId: string | null;                   // widget immediately before (above for H, left for V) this line
  afterId: string | null;                    // widget immediately after  (below for H, right for V) this line
  rowIndex?: number;                         // H-line only: row gap index (0 = above-first, rows.length = below-last)
  isActive: boolean;                         // pointer inside snap radius (and !disabled)
  disabled: boolean;
};
```

`beforeId`/`afterId` fully describe each line's position. The pair `(null, first.id)` = outer-left or above-first, `(last.id, null)` = outer-right or below-last, `(A.id, B.id)` = between A and B. The intent resolver looks up the row for V-lines using these two ids.

### 5.2 Extended `DropZone`

```ts
export type DropZone =
  | { type: "gap"; beforeId: string | null; afterId: string | null; index: number }
  | { type: "widget"; targetId: string; side: "left" | "right" }
  | { type: "empty"; column: number }
  | { type: "outside" }
  // NEW:
  | { type: "insertion-line-h"; lineId: string; insertionIndex: number; beforeId: string | null; afterId: string | null }
  | { type: "insertion-line-v"; lineId: string; insertionIndex: number; beforeId: string | null; afterId: string | null };
```

### 5.3 Extended `OperationIntent`

```ts
export type OperationIntent =
  | { type: "none" }
  | { type: "reorder"; targetIndex: number }
  | { type: "swap"; targetId: string }
  | { type: "auto-resize"; targetId: string; sourceSpan: number; targetSpan: number; targetIndex: number }
  | { type: "column-pin"; column: number; pointerY?: number; _insertionIndex?: number }
  | { type: "empty-row-maximize"; newSpan: number; pointerY?: number; _insertionIndex?: number }
  // NEW:
  | { type: "new-row"; insertionIndex: number; colSpan: number }
  | { type: "in-row-insert"; insertionIndex: number; resize: ReadonlyArray<{ id: string; newSpan: number }> };
```

`in-row-insert.resize` includes the source widget (`id === sourceId`, `newSpan` = source's resulting span) when its span changes, plus any stationary whose span changes.

### 5.4 Extended `CommittedOperation`

```ts
export type CommittedOperation =
  | …existing seven cases…
  // NEW:
  | { type: "new-row"; sourceId: string; insertionIndex: number; colSpan: number }
  | { type: "in-row-insert"; sourceId: string; insertionIndex: number; resize: ReadonlyArray<{ id: string; newSpan: number }> };
```

### 5.5 Extended `DragEngineSnapshot`

```ts
export interface DragEngineSnapshot {
  phase: DragPhase;
  layout: ComputedLayout;
  previewLayout: ComputedLayout | null;
  intent: OperationIntent | null;
  zone: DropZone | null;
  dragPosition: Point | null;
  announcement: string | null;
  widgets: WidgetState[];
  dwellProgress: number;
  canUndo: boolean;
  canRedo: boolean;
  insertionLines: InsertionLine[];   // NEW — empty array unless lines should render
}
```

`insertionLines` is `[]` when:
- not dragging, OR
- `dropMode === 'classic'`, OR
- source is `position`-locked

Otherwise it contains all candidate lines for the current layout, regardless of pointer position. Exactly one line has `isActive: true` (or none, if no line is within snap radius).

### 5.6 Extended `DragEngineConfig`

```ts
export interface DragEngineConfig {
  …existing…
  dropMode: "classic" | "lines" | "both";  // default 'classic'
  lineSnapRadius: number;                   // default 16
}
```

## 6. Algorithms

### 6.1 `computeInsertionLines(layout, widgets, sourceId, mode, config) → InsertionLine[]`

Pure function. Returns `[]` when `mode === 'classic'` or `sourceId` is position-locked. Otherwise:

1. Group stationaries (`widgets.filter(w => w.visible && w.id !== sourceId)`) into rows using their `layout.positions` `y` coordinate (widgets with `|y - y'| < 1` share a row).
2. For each row, emit V-lines per §4.1 (skip if `maxColumns === 1`).
3. Emit H-lines per §4.2.
4. For each line, compute `disabled` per §4.3.
5. Compute stable `id` from orientation + neighbour ids.
6. `isActive` is filled in by the resolver, not by this function — initial pass returns all lines with `isActive: false`.

### 6.2 `resolveZone` extension

Pseudocode (replaces current `resolveZone` body when `mode !== 'classic'`):

```ts
function resolveZone(pointer, layout, widgets, gap, maxColumns, containerWidth,
                    sourceId, currentWidgetSide, mode, lines, lineSnapRadius) {
  if (mode !== "classic") {
    const widgetHit = resolveWidgetHit(pointer, ...);   // existing
    if (widgetHit) return widgetHit;                     // swap-on-widget wins

    const snapped = findSnappedLine(pointer, lines, lineSnapRadius);
    if (snapped) {
      return {
        type: snapped.orientation === "horizontal" ? "insertion-line-h" : "insertion-line-v",
        lineId: snapped.id,
        insertionIndex: snapped.insertionIndex,
        beforeId: snapped.beforeId,
        afterId: snapped.afterId,
      };
    }

    if (mode === "lines") return { type: "outside" };
    // mode === "both" falls through:
  }

  return classicResolveZone(...);                        // existing logic verbatim
}
```

`findSnappedLine` iterates enabled lines, computes pointer-to-line distance with hysteresis (see §6.3), and returns the closest line within `lineSnapRadius`.

### 6.3 Magnetism + hysteresis

Distance to a line (perpendicular distance to the line segment, clamped to its extent):

- **V-line** (vertical segment at `x = line.x1` from `y1` to `y2`):
  - If `pointer.y` ∈ `[y1, y2]`: `dist = |pointer.x - line.x1|`
  - Else: `dist = √((pointer.x - line.x1)² + min(|pointer.y - y1|, |pointer.y - y2|)²)`
- **H-line** (horizontal segment at `y = line.y1` from `x1` to `x2`):
  - If `pointer.x` ∈ `[x1, x2]`: `dist = |pointer.y - line.y1|`
  - Else: same edge-distance formula with axes swapped

Rules:

- **Entry**: line becomes active when `dist ≤ lineSnapRadius`.
- **Exit**: once active, the line stays active until `dist > lineSnapRadius + 8`. Re-uses the existing 2-frame hysteresis applied to all zones (`engine/utils.ts` `zonesEqual`).
- **Multi-line proximity**: when several enabled lines are inside their snap radius simultaneously, the one with smallest `dist` wins. Tie → previously-snapped line wins (or first-emitted if none was snapped).
- **Disabled lines** never become active (distance check skips them).

### 6.4 Equal-distribute resize (V-line → in-row-insert)

Input: row `R` of stationary widgets `[w1, …, wN]` (excluding source), source `S` with span `s`, insertion side `(beforeId, afterId)`. Output: `resize[]` map + final `insertionIndex`, or `null` if not feasible.

```ts
function equalDistribute(R, S, s, maxColumns, getConstraints, isResizeLocked):
  spans = [...R.map(w => w.colSpan), s]                  // including source
  total = sum(spans)

  if (total <= maxColumns):
    return { resize: [], total }                          // fits as-is

  n = spans.length
  base = Math.floor(maxColumns / n)
  rem  = maxColumns - base * n                            // 0..n-1
  newSpans = spans.map((_, i) => base + (i < rem ? 1 : 0))

  // Clamp to per-widget constraints
  for i in 0..n-1:
    id = (i < N) ? R[i].id : S.id
    c  = getConstraints(id)
    if newSpans[i] < c.minSpan:
      return null                                         // can't fit — line disabled
    if newSpans[i] > c.maxSpan:
      newSpans[i] = c.maxSpan                             // re-distribute remainder upward
    if i < N && isResizeLocked(R[i].id) && newSpans[i] !== R[i].colSpan:
      return null                                         // resize-lock blocks

  if (sum(newSpans) > maxColumns) return null             // still doesn't fit after clamping

  // Build resize delta (only widgets whose span changes)
  resize = []
  for i in 0..n-1:
    id = (i < N) ? R[i].id : S.id
    if newSpans[i] !== originalSpan(id): resize.push({ id, newSpan: newSpans[i] })

  return { resize, insertionIndex: computeIndex(R, beforeId, afterId, S) }
```

`computeIndex` is the existing logic used for gap zones: convert `(beforeId, afterId)` into a widgets-array index, adjusted for source removal.

### 6.5 New-row drop (H-line → new-row intent)

```ts
function newRowIntent(S, line, maxColumns, getConstraints):
  c = getConstraints(S.id)
  colSpan = Math.min(maxColumns, c.maxSpan)
  return { type: "new-row", insertionIndex: line.insertionIndex, colSpan }
```

H-lines are never disabled by resize logic (they don't resize anything). The only `disabled` cases for H-lines come from §4.3 self-adjacent.

### 6.6 Intent resolver extension

```ts
case "insertion-line-h": {
  return newRowIntent(source, zone, config.maxColumns, config.getWidgetConstraints);
}
case "insertion-line-v": {
  const row = findRowForLine(zone.lineId, layout, widgets);
  const result = equalDistribute(row, source, source.colSpan, config.maxColumns,
                                  config.getWidgetConstraints, config.isResizeLocked);
  if (!result) return { type: "none" };
  return {
    type: "in-row-insert",
    insertionIndex: result.insertionIndex,
    resize: result.resize,
  };
}
```

No dwell required — line intents commit immediately on release.

## 7. Operation applier additions

`operation-applier.ts` adds two cases. Both reuse existing reducer actions (`RESIZE_WIDGET`, `REORDER_WIDGETS`, `BATCH_UPDATE`); no new action types needed. The applier emits a single `BATCH_UPDATE` so undo/redo treats the drop as one atomic step.

### 7.1 `new-row` semantics

- If `source.colSpan !== op.colSpan`: emit `RESIZE_WIDGET(sourceId, op.colSpan)`.
- Emit `REORDER_WIDGETS(fromIndex, op.insertionIndex)`.
- Clear any stale `columnStart` hints (existing pattern after reorder operations).
- All wrapped in a single `BATCH_UPDATE`.

When `source.maxSpan < maxColumns` the resize is clamped to `source.maxSpan`. Bin-packing may place the widget on a shared row in that case — **accepted v1 limitation**, see §11.1. A future `rowStart` field on `WidgetState` could harden this.

### 7.2 `in-row-insert` semantics

- For each `{ id, newSpan }` in `op.resize`: emit `RESIZE_WIDGET(id, newSpan)`.
- Emit `REORDER_WIDGETS(fromIndex, op.insertionIndex)`.
- Clear any stale `columnStart` hints.
- All wrapped in a single `BATCH_UPDATE`.

## 8. React layer

### 8.1 Context value

`DashboardDragContextValue` (volatile context) adds:

```ts
insertionLines: InsertionLine[];
```

Wired directly from `DragEngineSnapshot.insertionLines`. Empty array when not applicable.

### 8.2 Hooks

- `useDashboardDrag()` — existing hook; returned object now includes `insertionLines`.
- `useInsertionLines()` — new convenience hook:
  ```ts
  export function useInsertionLines(): InsertionLine[] {
    return useDashboardDrag().insertionLines;
  }
  ```

No per-line subscription hook in v1. UIs that need fine-grained re-render can compare by `line.id + line.isActive + line.disabled`.

### 8.3 Exports

`src/lib/dashboard/index.ts`:

```ts
export { useInsertionLines } from "./react/use-insertion-lines.ts";
```

`engine-entry.ts`:

```ts
export type { InsertionLine } from "./engine/types.ts";
```

## 9. Demo changes (out-of-library)

`src/app/components/DashboardGrid.tsx` renders lines alongside ghost:

```tsx
const lines = useInsertionLines();
…
{lines.map(line => <InsertionLineElement key={line.id} line={line} />)}
```

New `src/app/components/InsertionLineElement.tsx` (demo-only, NOT in library):

- Styles horizontal vs vertical orientation.
- Active state (`isActive`): bolder color, optional glow.
- Disabled state (`disabled`): dimmed, no hover affordance.
- Uses `motion/react` for fade-in on drag start / fade-out on drag end (matches existing ghost animation in the demo).

Default demo uses `dropMode="both"` so playgrounds exhibit both behaviors. Existing demo controls panel gets a `dropMode` selector.

## 10. Testing

### 10.1 Existing tests

**Unchanged.** Default `dropMode: 'classic'` preserves every current zone and intent code path. Existing e2e + unit tests must pass with no modification (per project rule: tests are the spec).

### 10.2 New e2e tests (all use existing util patterns per CLAUDE.md)

| File | Coverage |
|---|---|
| `insertion-lines-render.spec.ts` | Line emission count + geometry per layout, only during drag, hides on drop/cancel |
| `insertion-lines-magnetic.spec.ts` | Snap radius entry/exit, hysteresis behavior, tie-break between nearby lines |
| `insertion-lines-h-drop.spec.ts` | Top H-line, bottom H-line, between-row H-line — all produce full-width new row |
| `insertion-lines-v-drop.spec.ts` | V-line drops that don't need resize, V-line drops with equal-distribute resize |
| `insertion-lines-edge-cases.spec.ts` | Self-adjacent disabled, resize-locked stationary disabled, 1-col mode has no V-lines, empty dashboard external drag |
| `insertion-lines-modes.spec.ts` | `'classic'` vs `'lines'` vs `'both'` arbitration; swap-on-widget-center works in every mode |

Each spec uses the position-notation + action-notation conventions documented in `CLAUDE.md`.

### 10.3 New unit tests

- `engine/__tests__/compute-insertion-lines.test.ts` — line geometry, count, disabled flags
- `engine/__tests__/resolve-zone-lines.test.ts` — snap radius + hysteresis + line vs widget precedence
- `engine/__tests__/equal-distribute.test.ts` — algorithm correctness across span/constraint combos
- `engine/__tests__/intent-resolver-lines.test.ts` — `insertion-line-h` → new-row, `insertion-line-v` → in-row-insert or none
- `engine/__tests__/operation-applier-lines.test.ts` — committed ops produce correct reducer actions

## 11. Open questions / accepted v1 limitations

### 11.1 H-line drop when `source.maxSpan < maxColumns`

The dropped widget can't go full width. v1 accepts that bin-packing may place it on a shared row. Mitigation: extend `WidgetState` with a `rowStart` field in a follow-up; non-breaking schema migration via existing `v1 → v2` persistence pattern.

### 11.2 Line ids and React keys

Stable id format: `${orientation}-${beforeId ?? "start"}-${afterId ?? "end"}-${rowIndex ?? ""}`. UIs use it as a React key. When the layout reflows (e.g., source picked up), line ids change consistently for unaffected positions; only the source-adjacent lines mutate.

### 11.3 No dwell timer on line drops

Intentional — lines are explicit position commits. Releasing while snapped commits immediately. `dwellProgress` reads 1 for line zones.

### 11.4 Accessibility

`useDragAnnouncements` keeps working off the existing `zone` / `intent` fields. New zone/intent variants need announcement strings:

- `insertion-line-h` active → "Insert new row above/below {widget}"
- `insertion-line-v` active → "Insert between {prev} and {next}, resizing row" (or "without resize" when no resize needed)

These announcement strings ship in v1 to avoid silent a11y regression.

## 12. Configuration reference

| Prop | Type | Default | Notes |
|---|---|---|---|
| `dropMode` | `'classic' \| 'lines' \| 'both'` | `'classic'` | New. Backward-compatible default. |
| `lineSnapRadius` | `number` | `16` | New. Pixels. Hysteresis exit threshold = `lineSnapRadius + 8`. |

## 13. Backward compatibility

- `DragEngineSnapshot.insertionLines` is an added field. Existing consumers ignoring it are unaffected.
- New `DropZone` / `OperationIntent` / `CommittedOperation` union variants are additive. Existing exhaustive `switch` checks in consumer code may complain at type-check; the library's own switches add the new cases.
- New `DashboardProvider` props default to current behavior. No consumer change required.

## 14. Out-of-scope (deferred)

- Multi-select drag (no current selection concept in the codebase).
- Animated dwell preview on hover lines.
- Sub-pixel line positioning APIs (UI takes integer pixels for now).
- Customizable resize algorithm (`equalDistribute` is hard-coded in v1; a `resizePolicy` prop could be added later).
- `WidgetState.rowStart` for guaranteed-new-row H-line drops (see §11.1).

## 15. Implementation order (rough; writing-plans skill will refine)

1. Types: `InsertionLine`, extended `DropZone` / `OperationIntent` / `CommittedOperation`, extended snapshot + config.
2. `computeInsertionLines` pure function + unit tests.
3. Extend `resolveZone` with line snap + hysteresis.
4. Extend `resolveIntent` for line zones + `equalDistribute` helper + unit tests.
5. Extend `operation-applier` for `new-row` and `in-row-insert`.
6. Plumb `dropMode` / `lineSnapRadius` through `DragEngineConfig`, `DashboardProvider`, defaults.
7. React: expose `insertionLines` on drag context + `useInsertionLines` hook.
8. Demo: render lines, add `dropMode` selector to controls panel.
9. E2E test suite (6 files).
10. README + CHANGELOG updates.

---

**Acceptance criteria**

- All existing unit + e2e tests pass with zero modification.
- All new e2e + unit tests pass.
- Library stays headless: no UI components added to `src/lib/dashboard/`.
- `dropMode` defaults to `'classic'`; existing consumers see no behavioral change.
- Public type exports include `InsertionLine` and the new zone/intent/operation variants.
