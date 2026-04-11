## Notation

### Position

Letters represent widgets. Doubled letters = colSpan 2. Tripled = colSpan 3. Same line = same row. Different lines = different rows. `x` = empty droppable cell (`x1`, `x2` when multiple).

```
A B C       → 3 widgets, same row, each colSpan 1
D           → 1 widget, row 2

A A B       → A has colSpan 2, B has colSpan 1
C           → C on row 2

A B C
x D         → empty space before D on row 2
```

### Actions

```
A -> B          drag A, drop on B (immediate release)
A ->| B         drag A, hold on B (dwell before release)
A ->| <B        drag A, hold on LEFT side of B
A ->| B>        drag A, hold on RIGHT side of B
A -> [below]    drag A to new row below all content
A -> [TRASH]    drag A to trash zone
[EXT] -> B      drag from external catalog onto B
[DBL] A         double-click A (resize toggle)
```

### Locks

```
A[PL]           position-locked (cannot be dragged or be a swap/resize target)
A[RL]           resize-locked (can be dragged/swapped, cannot change span)
A[XL]           remove-locked (can be dragged/resized, cannot be trashed)
```

### Keyboard

```
KEY_PICKUP A    Alt+Space to grab A
KEY_MOVE ↓      Arrow Down (move one position in order)
KEY_MOVE ↑      Arrow Up
KEY_RESIZE →    Shift+Arrow Right (grow colSpan by 1)
KEY_RESIZE ←    Shift+Arrow Left (shrink colSpan by 1)
KEY_DROP        Space to drop
KEY_CANCEL      Escape to cancel
```

---

## 1. Swap

Two widgets exchange positions. Spans are preserved. Bin-packing handles visual layout.

### Same-row, same span

```
A B C
A -> B
→ B A C
```

Only A and B exchange. C stays.

```
A B C
B -> C
→ A C B
```

```
A B C
A -> C
→ C B A
```

Non-adjacent swap. B stays.

### Same-row, different span

```
A A B
A -> B
→ B A A
```

A(2) and B(1) exchange. Both keep their colSpans. Still fits: 1 + 2 = 3.

```
A B B
A -> B
→ B B A
```

### Cross-row, same span

```
A B
C D
A -> D
→ D B
  C A
```

Only A and D exchange. B and C stay.

```
A B
C D
A -> C
→ C B
  A D
```

Same-column cross-row.

```
A B C
D E F
A -> F
→ F B C
  D E A
```

### Cross-row, different span

```
A A
B
A -> B
→ B
  A A
```

A(2) goes to row 2. B(1) goes to row 1.

```
A A
B B
A -> B
→ B B
  A A
```

Both wide, just flip row order.

### Wide source into full target row (overflow)

```
A B C
D D
D -> A (short dwell)
→ D D B
  C A
```

D(2) swaps with A(1). D keeps span 2. Row 1 overflows (2+1+1=4 > 3). Bin-packing pushes C to row 2.

```
A B C
D D
D ->| <A (long dwell)
→ D B C
  A
```

With long dwell: auto-resize triggers. D shrinks to 1 to fit alongside B and C.

### Self-drop (no-op)

```
A B C
x x D
D -> D
→ A B C
  x x D
```

No change. Dropping on yourself is always a no-op.

```
A B C
x x D
D ->| D (short dwell)
→ A B C
  x x D
```

Same — no-op even with dwell. Exception: if D is held long enough in an empty row, triggers empty-row-maximize (see section 4).

---

## 2. Auto-resize

After 600ms dwell on a widget, both source and target resize to fit side-by-side. Side indicator (`<` / `>`) determines placement order.

### Basic (2-col)

```
A A
B
B ->| <A
→ B A
```

B placed LEFT of A. Both shrink to colSpan 1.

```
A A
B
B ->| A>
→ A B
```

B placed RIGHT of A.

### 3-col

```
A A A
B
B ->| <A
→ B A A
```

A shrinks from 3 to 2. B stays 1. Total = 3.

```
A A A
B
B ->| A>
→ A A B
```

```
A A A
B B
B ->| <A
→ B B A
```

A shrinks to 1. B keeps 2.

```
A A A
B B
B ->| A>
→ A B B
```

### Short dwell falls back to swap

```
A A
B
B ->| <A (350ms)
→ B
  A A
```

Dwell below 600ms. Falls back to swap. Side indicator is ignored for swaps.

### Hold without side indicator

```
A B C
x x D
D ->| B (short dwell)
→ A D C
  x x B
```

Short dwell = swap.

```
D ->| B (long dwell, cursor left of B's center)
→ auto-resize with D on left
```

Long dwell = auto-resize. Side inferred from cursor position relative to target center.

### Side detection

Side is always detected from the center of the target widget. Even 1 pixel offset from center determines left vs right. Swap vs auto-resize is purely timing-based (dwell threshold).

### Displaced neighbors

```
A A
B C
C ->| <A
→ C A
  B
```

C joins A's row. B stays in its row alone.

```
A A B
C D E
E ->| A>
→ A E B
  C D
```

E moves up to A's row. D stays on row 2 with C.

### Target has row neighbors (no room)

```
A B C
D
D ->| <B (600ms)
→ swap (D ↔ B)
```

B already has A and C on its row. No room for auto-resize. Falls back to swap.

### MinSpan prevents fit

```
(A minSpan=2, B minSpan=2, 3-col)
A A A
B B
B ->| <A (600ms)
→ swap (B ↔ A)
```

2 + 2 = 4 > 3. Auto-resize impossible. Falls back to swap.

---

## 3. Column-pin

Drag to an empty cell. Widget pins to that column.

### Basic

```
A B C
D x1 x2
D -> x1
→ A B C
  x1 D x2
```

D moves from col 0 to col 1.

```
A B C
D x1 x2
D -> x2
→ A B C
  x1 x2 D
```

D moves to col 2.

### Wide widget pin

```
A B C
D D x
D -> x
→ A B C
  x D D
```

D(2) slides right. Keeps colSpan 2.

### ColSpan clamped on overflow

If pinning a colSpan-2 widget to col 2 in a 3-col grid: span clamps to 1 (col 2 + span 2 > 3).

### Cross-row pin

```
A A B C
D D x1 x2
C -> x2
→ A A B x1
  D D x2 C
```

C moves from row 1 to empty cell on row 2.

### Only targets empty cells

Column-pin only targets truly empty cells. If a row is full, no pin is possible — drag onto a widget triggers swap or auto-resize instead.

---

## 4. Empty-row-maximize

After 600ms dwell in an empty row, widget expands to maxSpan.

### Basic

```
A B
C
C ->| empty row (600ms)
→ A B
  C C
```

C expands from colSpan 1 to colSpan 2 (maxColumns).

### Self-hold maximize

```
A B C
x x D
D ->| D (600ms, D is in an empty row)
→ A B C
  D D D
```

D held on itself long enough in an empty row. Maximizes to colSpan 3.

### Already at max

```
A A
B
A ->| empty row (600ms)
→ B
  A A
```

A is already colSpan 2 (maxColumns). No resize. Just reorder/pin.

### Resize-locked

```
A B
C[RL]
C ->| empty row (600ms)
→ A B
  C
```

Resize lock prevents maximize even with sufficient dwell.

---

## 5. Trash

Drop on trash zone to remove widget.

### Basic

```
A B
C
A -> [TRASH]
→ B
  C
```

A removed. Remaining widgets compact.

```
A A
B C
A -> [TRASH]
→ B C
```

Wide widget trashed. Row collapses.

### Remove-locked

```
A[XL] B
A -> [TRASH]
→ A B
```

Remove lock prevents trashing. No change.

---

## 6. External drag-to-add

Drag from external catalog into dashboard. External drags can only trigger reorder, column-pin, or empty-row-maximize. Cannot swap with existing widgets.

### Drop into gap

```
A B
[EXT] -> (gap between A and B)
→ A [NEW] B
```

### Drop into empty cell (column-pin)

```
A B x
[EXT] -> x
→ A B [NEW]
```

New widget pinned to that column.

### Hold in empty row (maximize)

```
A B
[EXT] ->| [below] (600ms)
→ A B
  [NEW][NEW]
```

With sufficient dwell, external widget maximizes to full span.

### Leave dashboard (cancel)

```
A B
[EXT] enters then leaves
→ A B
```

Phantom removed. No state change.

---

## 7. Resize-toggle

Double-click toggles widget between minSpan and maxSpan.

### Expand

```
A B
[DBL] A
→ A A
  B
```

A expands from 1 to maxSpan (2). B pushed to row 2.

```
A B C
[DBL] A
→ A A A
  B C
```

A fills full 3-col row.

```
A B C
[DBL] B
→ A
  B B B
  C
```

B expands to maxSpan (3). A stays before B in order. C after.

### Shrink

```
A A
B
[DBL] A
→ A B
```

A shrinks from maxSpan (2) to minSpan (1). B moves up.

### Resize-locked

```
A[RL] B
[DBL] A
→ A B
```

No change.

### minSpan = maxSpan

```
(A: minSpan=2, maxSpan=2, 2-col)
A A
[DBL] A
→ A A
```

No change possible.

---

## 8. Cancel / No-op

All cancels result in NO state change.

- **Escape during drag**: widget returns to original position
- **Pointer cancel event** (system interrupt): same as escape
- **Release before activation threshold** (mouse <5px movement): treated as click, not drag
- **Drop outside grid boundary**: treated as cancel
- **External drag leaves dashboard**: phantom removed, no change
- **Drop on vacated spot**: dragging a widget then dropping it back on its original position = self-drop no-op

---

## 9. Lock interactions

### Position-locked (`[PL]`)

Cannot be dragged:
```
A[PL] B
A -> B
→ A B (drag rejected)
```

Cannot be a swap target:
```
A[PL] B
B -> A
→ A B (swap rejected)
```

Cannot be an auto-resize target:
```
A[PL] A
B
B ->| <A (600ms)
→ A A
  B (rejected)
```

Doesn't block uninvolved swaps:
```
A[PL] B C
B -> C
→ A C B
```

A is locked but not involved. B and C swap freely.

Blocks reorder THROUGH locked widget:
```
A B[PL] C
A -> (gap after C)
→ A B C (blocked, can't move past B)
```

Swap PAST locked widget is OK:
```
A B[PL] C
A -> C
→ C B A
```

A and C swap directly. B is not involved.

### Resize-locked (`[RL]`)

Can still be dragged and swapped:
```
A[RL] B
A -> B
→ B A
```

Blocks all span changes:
- Resize-toggle (`[DBL]`): no-op
- Empty-row-maximize: no maximize
- Auto-resize: target can't be resized (falls back to swap)
- Keyboard resize: blocked

### Remove-locked (`[XL]`)

Can be dragged and resized:
```
A[XL] B
A -> B
→ B A

A[XL] B
[DBL] A
→ A A
  B
```

Blocks trash:
```
A[XL] B
A -> [TRASH]
→ A B (no change)
```

---

## 10. Keyboard drag

### Move

```
A B
C
KEY_PICKUP A → KEY_MOVE ↓ → KEY_DROP
→ B A
  C
```

A moves one position down in widget order.

```
A B
C
KEY_PICKUP C → KEY_MOVE ↑ → KEY_MOVE ↑ → KEY_DROP
→ C B
  A
```

### Resize during keyboard drag

```
A B
C
KEY_PICKUP A → KEY_RESIZE → → KEY_DROP
→ A A
  B
  C
```

A grows to colSpan 2 while being keyboard-dragged.

### Combined move + resize

Both reorder and resize can happen in a single keyboard drag session.

### Cancel reverts everything

```
A B
KEY_PICKUP A → KEY_MOVE ↓ → KEY_RESIZE → → KEY_CANCEL
→ A B
```

No change. Both position and span revert.

### Boundaries

- Can't move above index 0 or below last index (no-op at boundaries)
- Can't grow beyond maxColumns or shrink below minSpan (clamped)
- Position-locked widget can't be picked up

---

## 11. Special cases

### Layout compaction

Empty rows never persist. Layout is always compacted — no gaps between widget rows.

### Bin-packing

Swap only changes widget order. The bin-packing layout algorithm computes the visual result. When a swap causes total colSpan in a row to exceed maxColumns, excess widgets wrap to the next row.

### Gap fill

When a widget leaves a row, remaining widgets slide left to fill the gap:

```
A B C
D E
B -> [below]
→ A C
  D E
  B
```

C slides from col 2 to col 1.

### Single-column grid (maxColumns = 1)

Auto-resize is impossible (can't fit 2 widgets side-by-side). All hold-on-widget actions degrade to swap:

```
(1-col grid)
A
B
B ->| <A (600ms)
→ B
  A
```
