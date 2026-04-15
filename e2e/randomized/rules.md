# Drag Operation Rules

Concrete rules for evaluating drag-and-drop test results. Each rule includes a worked example.

## Grid Format

- 2D array: rows × columns
- Each cell = widget ID (lowercase letter) OR null (empty, shown as `.`)
- Multi-column widgets repeat their ID in consecutive cells of the same row
- ColSpan of widget = count of consecutive cells it occupies in a row

Example: a 3-col grid with widget `a` spanning 2 cols and widget `b` spanning 1:
```
a a b
```
= `[["a", "a", "b"]]`

## Global Invariants (MUST hold for every valid result)

1. **Widget preservation**: same set of widget IDs before and after. No widget created or lost.
2. **ColSpan preservation**: each widget keeps its colSpan UNLESS the operation explicitly resizes it (auto-resize, empty-row-maximize).
3. **Bounds**: no widget extends past `maxColumns - 1`.
4. **Contiguity**: each widget's cells in a row are consecutive (no gaps within a widget).
5. **Vertical compaction**: no fully-empty row between two occupied rows. Layout bin-packs from the top.
6. **No partial overlaps**: two widgets cannot share a cell.

If a global invariant is violated, the result is DEFINITELY WRONG regardless of intent.

## Operations

### swap
`{ do: "swap", source, target }`

Source and target exchange positions. Other widgets shift only as needed to make the new arrangement valid (bin-pack).

Example (2-col):
```
Before:          After swap(a, d):
a b              d b
c d              c a
```

Example with different colSpans (3-col):
```
Before:          After swap(a, c):
a a b            c c b
c .              a .
```
Widget `a` (span 2) and `c` (span 1) swap. `a` moves to where `c` was. `c` takes `a`'s row. ColSpans are preserved.

### autoResize
`{ do: "autoResize", source, target, side }`

Source is held on the LEFT or RIGHT edge of target. They end up on the SAME ROW. ColSpans are adjusted so they fit together within `maxColumns`.

Adjustment rule:
- Try to preserve both original colSpans if `source.colSpan + target.colSpan ≤ maxColumns`.
- Otherwise shrink proportionally, minimum 1 each.

Example (3-col, side=right):
```
Before:              After autoResize(a → right of b):
a a .                b a a
b b .                (b at col 0 shrinks to 1, a at col 1-2 keeps span 2)
```

Example (3-col, side=left):
```
Before:              After autoResize(a → left of b):
a a .                a a b
b b .                (a keeps span 2 at col 0-1, b shrinks to 1 at col 2)
```

Key check: source is on the specified side of target in the final row.

### dragToColumn
`{ do: "dragToColumn", source, col }`

Source widget is placed starting at column `col`. Layout re-packs. If the target column is already occupied at the destination row, other widgets shift.

Example (3-col):
```
Before:              After dragToColumn(b, col=2):
a b c                a c b
```
Widget `b` moves to col 2. `c` shifts left to fill the gap.

### dragToColumnAt
`{ do: "dragToColumnAt", source, col, ref }`

Source widget moves to column `col` at the SAME ROW as the `ref` widget.

Example (2-col):
```
Before:              After dragToColumnAt(a, col=1, ref=d):
a a                  . b
b c                  c d
d e                  a e    (a moved to row of d, col 1; d stays at col 0 of its row)
```

### dragToEmpty
`{ do: "dragToEmpty", source, direction }`

Source moves into adjacent empty space in its own row (left or right).

Example (3-col):
```
Before:              After dragToEmpty(a, right):
a . .                . . a   (moves right as far as it can)
```

If no adjacent empty space exists, the operation is a no-op (grid unchanged).

### dragToEmptyCell
`{ do: "dragToEmptyCell", source, col }`

Source is dragged into the empty area BELOW all existing widgets, at column `col`. Creates a new row at the bottom (or moves source to an existing empty row).

Example (2-col):
```
Before:              After dragToEmptyCell(b, col=0):
a b                  a .
                     b .
```

## No-op Rule

If an action cannot produce a valid layout (violates invariants, target is same as source, etc.), the engine may return the grid unchanged. A no-op is ACCEPTABLE only when the action is literally impossible — not just "harder to interpret".

## Evaluation Heuristics

When judging a result:
1. First check global invariants. Any violation = WRONG.
2. Check that the operation-specific rule was applied (right side, right column, etc.).
3. Check colSpan preservation (only auto-resize legally changes spans).
4. If widgets not involved moved more than needed for bin-packing, that's suspicious.
5. If the result looks like a reasonable alternative interpretation, confidence = medium (40-70), not low.
