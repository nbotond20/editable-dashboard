# Dashboard Drag-and-Drop Behavior Reference

## How It Works

The drag system is **simulation-based**: for every possible drop position, it runs the real layout algorithm and picks the result closest to the pointer. The distance metric weights vertical distance 1.5x heavier than horizontal, so crossing rows requires more deliberate movement.

Five candidate families are generated on every frame:

| Family | What it does | When it activates |
|--------|-------------|-------------------|
| **Stack** | Insert at a new position (shift others) | Always (2+ widgets) |
| **Side-drop** | Resize one peer + dragged to share a row | `peer.colSpan + dragged.colSpan > maxColumns` |
| **Swap** | Exchange positions of two widgets | Dragged and target are in different rows |
| **Row squeeze** | Resize all widgets in a row to fit | Multiple peers in row, combined span overflows |
| **Column placement** | Slide widget to a different column | Always (keeps same order) |

---

## Notation

```
[A]  = widget A, span 1
[A  ] = widget A, span 2
[A    ] = widget A, span 3
 ↓   = drag direction
 →   = drag direction
 ⇄   = swap
```

---

## 1. Same-Row Reorder (Insert)

When you drag a widget past another widget **in the same row**, the system inserts the dragged widget at the new position. Other widgets shift to fill the gap.

### 1.1 Two widgets, swap positions

```
BEFORE (2 cols):        Drag A → right past B:        AFTER:
┌─────┐ ┌─────┐                                      ┌─────┐ ┌─────┐
│  A  │ │  B  │        A ──→ past B's center          │  B  │ │  A  │
└─────┘ └─────┘                                       └─────┘ └─────┘
```

```
BEFORE (3 cols):        Drag A → right past B:        AFTER:
┌───┐ ┌───┐ ┌───┐                                    ┌───┐ ┌───┐ ┌───┐
│ A │ │ B │ │ C │      A ──→ past B's center          │ B │ │ A │ │ C │
└───┘ └───┘ └───┘                                     └───┘ └───┘ └───┘
```

### 1.2 Skip past multiple widgets

```
BEFORE (3 cols):        Drag A → right past C:        AFTER:
┌───┐ ┌───┐ ┌───┐                                    ┌───┐ ┌───┐ ┌───┐
│ A │ │ B │ │ C │      A ──────────→ past C           │ B │ │ C │ │ A │
└───┘ └───┘ └───┘                                     └───┘ └───┘ └───┘
```

B and C shift left, A goes to the end.

### 1.3 Drag from right to left

```
BEFORE (3 cols):        Drag C ← left past A:         AFTER:
┌───┐ ┌───┐ ┌───┐                                    ┌───┐ ┌───┐ ┌───┐
│ A │ │ B │ │ C │      C ←────────── past A           │ C │ │ A │ │ B │
└───┘ └───┘ └───┘                                     └───┘ └───┘ └───┘
```

---

## 2. Cross-Row Swap

When you drag a widget to a position in a **different row**, the system swaps the two widgets. Only the dragged widget and the target move; all other widgets stay put.

### 2.1 Drag from row 1 to row 0

```
BEFORE (3 cols):        Drag D ↑ to A's position:     AFTER:
┌───┐ ┌───┐ ┌───┐                                    ┌───┐ ┌───┐ ┌───┐
│ A │ │ B │ │ C │            ↑                        │ D │ │ B │ │ C │
└───┘ └───┘ └───┘      D ───┘                        └───┘ └───┘ └───┘
┌───┐                                                 ┌───┐
│ D │                                                 │ A │
└───┘                                                 └───┘
```

D and A exchange positions. B and C are untouched.

### 2.2 Drag to a specific widget in the row

```
BEFORE (3 cols):        Drag D ↑ to B's position:     AFTER:
┌───┐ ┌───┐ ┌───┐                                    ┌───┐ ┌───┐ ┌───┐
│ A │ │ B │ │ C │              ↑                      │ A │ │ D │ │ C │
└───┘ └───┘ └───┘        D ───┘                      └───┘ └───┘ └───┘
┌───┐                                                 ┌───┐
│ D │                                                 │ B │
└───┘                                                 └───┘
```

### 2.3 Drag from row 0 down to row 1

```
BEFORE (3 cols):        Drag A ↓ to D's position:     AFTER:
┌───┐ ┌───┐ ┌───┐                                    ┌───┐ ┌───┐ ┌───┐
│ A │ │ B │ │ C │      A ───┐                         │ D │ │ B │ │ C │
└───┘ └───┘ └───┘           ↓                         └───┘ └───┘ └───┘
┌───┐                                                 ┌───┐
│ D │                                                 │ A │
└───┘                                                 └───┘
```

### 2.4 Swap with mixed spans

```
BEFORE (3 cols):        Drag C ↑ to A's area:         AFTER:
┌────────┐ ┌───┐                                      ┌────────┐ ┌───┐
│ A (2)  │ │ B │            ↑                         │ A (2)  │ │ C │
└────────┘ └───┘       C ──┘                          └────────┘ └───┘
┌───┐                                                 ┌───┐
│ C │                                                 │ B │
└───┘                                                 └───┘
```

C swaps with B (the widget whose center is closest to the pointer).

---

## 3. Column Shift (Slide Within Row)

When you drag a widget **horizontally** and it stays in its current row, you can slide it to a different column. The widget keeps its order but gets a `columnStart` hint.

### 3.1 Slide a solo widget to another column

```
BEFORE (3 cols):        Drag C → to col 1:            AFTER:
┌────────┐ ┌───┐                                      ┌────────┐ ┌───┐
│ A (2)  │ │ B │                                       │ A (2)  │ │ B │
└────────┘ └───┘                                       └────────┘ └───┘
┌───┐                   C ──→                                ┌───┐
│ C │                                                        │ C │
└───┘                                                        └───┘
 col 0                                                        col 1
```

### 3.2 Slide to the rightmost column

```
BEFORE (3 cols):        Drag C → to col 2:            AFTER:
┌────────┐ ┌───┐                                      ┌────────┐ ┌───┐
│ A (2)  │ │ B │                                       │ A (2)  │ │ B │
└────────┘ └───┘                                       └────────┘ └───┘
┌───┐                   C ────────→                                ┌───┐
│ C │                                                              │ C │
└───┘                                                              └───┘
 col 0                                                              col 2
```

### 3.3 Single visible widget

```
BEFORE (2 cols):        Drag A → to col 1:            AFTER:
┌───┐                                                        ┌───┐
│ A │                   A ──→                                 │ A │
└───┘                                                        └───┘
 col 0                                                        col 1
```

Works even with only one visible widget.

---

## 4. Side-Drop (Resize One Peer)

When you drag a widget next to another widget and their **combined spans exceed maxColumns**, both resize to fit side by side.

### 4.1 Two full-width widgets share a row

```
BEFORE (2 cols):        Drag B → next to A:           AFTER:
┌──────────┐                                          ┌─────┐ ┌─────┐
│  A (2)   │                 ↑                        │A (1)│ │B (1)│
└──────────┘            B ───┘                        └─────┘ └─────┘
┌──────────┐
│  B (2)   │
└──────────┘
```

Both A and B resize from span-2 to span-1.

### 4.2 Side-drop in 3-column layout

```
BEFORE (3 cols):        Drag B ↑ next to A:           AFTER:
┌──────────────┐                                      ┌─────────┐ ┌───┐
│    A (3)     │            ↑                         │  A (2)  │ │B 1│
└──────────────┘       B ──┘                          └─────────┘ └───┘
┌─────────┐
│  B (2)  │
└─────────┘
```

A shrinks from 3 to 2 (gets the larger half), B shrinks from 2 to 1.

### 4.3 Choosing side: before vs after

```
BEFORE (2 cols):        Drag B to LEFT of A:          AFTER:
┌──────────┐                                          ┌─────┐ ┌─────┐
│  A (2)   │            ↑ (pointer on left side)      │B (1)│ │A (1)│
└──────────┘       B ──┘                              └─────┘ └─────┘
┌──────────┐
│  B (2)   │
└──────────┘

BEFORE (2 cols):        Drag B to RIGHT of A:         AFTER:
┌──────────┐                                          ┌─────┐ ┌─────┐
│  A (2)   │                    ↑ (pointer on right)  │A (1)│ │B (1)│
└──────────┘               B ──┘                      └─────┘ └─────┘
┌──────────┐
│  B (2)   │
└──────────┘
```

The pointer's horizontal position determines which side.

### 4.4 No resize needed (already fits)

```
BEFORE (3 cols):        Drag B to other side of A:    AFTER:
┌─────────┐ ┌───┐                                    ┌───┐ ┌─────────┐
│  A (2)  │ │ B │      B ←── past A                   │ B │ │  A (2)  │
└─────────┘ └───┘                                     └───┘ └─────────┘
```

2 + 1 = 3 which fits in 3 columns. No resize — pure reorder.

---

## 5. Row Squeeze (Resize Multiple Peers)

When you drag a widget into a row where **multiple** widgets need resizing to make room, all widgets in that row shrink.

### 5.1 Two span-2 widgets, insert span-1

```
BEFORE (3 cols):        Drag E ↑ into row 0:          AFTER:
┌─────────┐                                           ┌───┐ ┌───┐ ┌───┐
│  A (2)  │                 ↑                         │A 1│ │E 1│ │B 1│
└─────────┘            E ──┘                          └───┘ └───┘ └───┘
┌─────────┐
│  B (2)  │
└─────────┘
┌───┐
│ E │
└───┘
```

Both A and B shrink from span-2 to span-1. E (already span-1) fits in.
The pointer position determines where E lands in the row (left, middle, right).

### 5.2 Mixed spans in the row

```
BEFORE (3 cols):        Drag D ↑ into row 0:          AFTER:
┌───┐ ┌─────────┐                                     ┌───┐ ┌───┐ ┌───┐
│ A │ │  B (2)  │           ↑                         │ A │ │ D │ │B 1│
└───┘ └─────────┘      D ──┘                          └───┘ └───┘ └───┘
┌─────────┐
│  C (2)  │
└─────────┘
┌───┐
│ D │
└───┘
```

A stays span-1, B shrinks to span-1, D takes the remaining spot.

---

## 6. Single-Column Mode

In 1-column mode, all widgets stack vertically. Only vertical reordering is possible.

### 6.1 Vertical reorder

```
BEFORE (1 col):         Drag A ↓ past B:              AFTER:
┌───────────┐                                         ┌───────────┐
│     A     │           A ─┐                          │     B     │
└───────────┘              ↓                          └───────────┘
┌───────────┐                                         ┌───────────┐
│     B     │                                         │     A     │
└───────────┘                                         └───────────┘
┌───────────┐                                         ┌───────────┐
│     C     │                                         │     C     │
└───────────┘                                         └───────────┘
```

### 6.2 Skip past multiple

```
BEFORE (1 col):         Drag A ↓ past C:              AFTER:
┌───────────┐                                         ┌───────────┐
│     A     │           A ─┐                          │     B     │
└───────────┘              │                          └───────────┘
┌───────────┐              │                          ┌───────────┐
│     B     │              │                          │     C     │
└───────────┘              │                          └───────────┘
┌───────────┐              ↓                          ┌───────────┐
│     C     │                                         │     A     │
└───────────┘                                         └───────────┘
```

---

## 7. Two-Column Mode Scenarios

### 7.1 Reorder within a row

```
BEFORE (2 cols):        Drag A → past B:              AFTER:
┌─────┐ ┌─────┐                                      ┌─────┐ ┌─────┐
│  A  │ │  B  │        A ──→                          │  B  │ │  A  │
└─────┘ └─────┘                                       └─────┘ └─────┘
┌─────┐ ┌─────┐                                      ┌─────┐ ┌─────┐
│  C  │ │  D  │                                       │  C  │ │  D  │
└─────┘ └─────┘                                       └─────┘ └─────┘
```

### 7.2 Cross-row swap

```
BEFORE (2 cols):        Drag C ↑ to A:                AFTER:
┌─────┐ ┌─────┐                                      ┌─────┐ ┌─────┐
│  A  │ │  B  │            ↑                          │  C  │ │  B  │
└─────┘ └─────┘       C ──┘                           └─────┘ └─────┘
┌─────┐ ┌─────┐                                      ┌─────┐ ┌─────┐
│  C  │ │  D  │                                       │  A  │ │  D  │
└─────┘ └─────┘                                       └─────┘ └─────┘
```

### 7.3 Full-width to side-by-side

```
BEFORE (2 cols):        Drag B sideways to A:         AFTER:
┌──────────┐                                          ┌─────┐ ┌─────┐
│  A (2)   │                                          │A (1)│ │B (1)│
└──────────┘                 ↑                        └─────┘ └─────┘
┌──────────┐            B ──┘
│  B (2)   │
└──────────┘
```

---

## 8. Edge Cases

### 8.1 Drag but don't move far enough

```
Pointer moves < 5px from initial click → No drag activated, no change.
```

### 8.2 Drag to same position

```
Pointer stays near widget's current center → No-op detected, ghost doesn't appear.
```

### 8.3 Column-placement at current column

```
Widget at col 0, pointer moves slightly → Column-placement candidate for col 0
wins but produces same (x, y) → No-op detected, no state change.
```

### 8.4 Hidden widgets ignored

```
BEFORE (2 cols):                     AFTER dragging A past C:
┌─────┐ ┌─────┐                     ┌─────┐ ┌─────┐
│  A  │ │  C  │  (B is hidden)      │  C  │ │  A  │
└─────┘ └─────┘                      └─────┘ └─────┘

B remains hidden and unaffected.
```

### 8.5 Row-based height equalisation

The layout engine equalises column heights at row boundaries. When a widget would start a new row, all columns are levelled to the tallest before placement begins. This means each row acts independently — swapping widgets within a row never shifts widgets in other rows, even when the swapped widgets have different heights.

```
BEFORE (2 cols):        Swap B and C:                 AFTER:
┌──────────┐            (C is taller than B)          ┌──────────┐
│  A (2)   │                                          │  A (2)   │
├─────┬────┤                                          ├────┬─────┤
│  B  │ C  │                                          │ C  │  B  │
│     │    │                                          │    │     │
│     │    │                                          │    │     │
├─────┼────┤                                          ├────┼─────┤
│  D  │    │  ← row starts at max(B,C) height         │ D  │     │  ← D stays at col 0
└─────┘    │                                          └────┘     │
```

The row below B/C always starts at the same Y (the taller of B and C plus gap), regardless of which column each is in. D's column is unaffected.

### 8.6 Escape cancels drag

```
User presses Escape during drag → drag aborted, widget returns to
original position, no state changes applied.

Also triggers on: tab switch (visibilitychange), pointer capture loss (pointercancel).
```

### 8.7 Resize persists after separation

```
BEFORE:                  Side-drop:                    Later reorder:
┌──────────┐             ┌─────┐ ┌─────┐              ┌─────┐
│  A (2)   │     →       │A (1)│ │B (1)│      →       │A (1)│  ← stays span-1!
└──────────┘             └─────┘ └─────┘               └─────┘
┌──────────┐                                           ┌─────┐
│  B (2)   │                                           │B (1)│  ← stays span-1!
└──────────┘                                           └─────┘
```

Side-drop resizes are **permanent**. Use the expand/shrink button to restore.

### 8.8 columnStart cleared on reorder

```
Widget C has columnStart=2 (was slid to col 2).
Any reorder of ANY widget clears ALL columnStart hints.
C snaps back to its natural bin-packed position (col 0, leftmost).
```

### 8.9 columnStart cleared on batch update

```
Widget A has columnStart=2 from a previous drag.
Widget B is side-dropped next to C → BATCH_UPDATE fires.
A's columnStart is cleared in the batch (prevents stale hints).
```

---

## 9. Decision Flowchart

```
User drags widget W to position P
          │
          ▼
   ┌─────────────┐
   │ Moved ≥ 5px │──No──→ No change
   │  from start? │
   └──────┬──────┘
          │ Yes
          ▼
  ┌──────────────────┐
  │ Generate all      │
  │ candidates:       │
  │  • Stack (insert) │
  │  • Side-drop      │
  │  • Swap           │
  │  • Row squeeze    │
  │  • Column place   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ For each candidate│
  │ run full layout   │
  │ & measure distance│
  │ to pointer        │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Pick closest      │
  │ (prefer swap on   │
  │  distance tie)    │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Same position as  │──Yes──→ No change (no-op)
  │ current layout?   │
  └────────┬─────────┘
           │ No
           ▼
  ┌──────────────────┐
  │ Stable for 2+     │──No──→ Keep current target
  │ frames?            │        (hysteresis)
  └────────┬──────────┘
           │ Yes
           ▼
    ┌──────────────┐
    │ Show preview: │
    │ • Ghost at    │
    │   drop pos    │
    │ • Others shift│
    │   to preview  │
    └──────┬───────┘
           │
           ▼
    User releases pointer
           │
           ▼
    ┌──────┴───────┐
    │  swapWithId?  │
    ├──Yes─────────────→ Exchange orders of 2 widgets
    │                    Clear all columnStart
    │                    via BATCH_UPDATE
    │
    ├──No
    │  ┌───────────┐
    │  │ Resizes or │──Yes──→ Apply resizes + columnStart
    │  │ columnStart│         Clear stale hints
    │  │ needed?    │         via BATCH_UPDATE
    │  └─────┬─────┘
    │        │ No
    │        ▼
    │  ┌───────────┐
    │  │  Index     │──Yes──→ Splice reorder
    │  │  changed?  │         via REORDER_WIDGETS
    │  └─────┬─────┘         (clears all columnStart)
    │        │ No
    │        ▼
    │     No change
    └──────────────┘
```

---

## 10. Configuration

| Setting | Default | Effect |
|---------|---------|--------|
| `maxColumns` | 2 | 1, 2, or 3 columns. Affects layout and all candidates. |
| `gap` | 16px | Space between widgets. |
| `DRAG_ACTIVATION_THRESHOLD` | 5px | Minimum pointer movement to start a drag. |
| `LAYOUT_SPRING` | stiffness:300, damping:30, mass:0.8 | Animation feel for widget transitions. |
| Vertical weight | 1.5x | Vertical distance penalized 1.5x in candidate scoring. |
| Hysteresis | 2 frames | New target must be stable for 2 frames before switching. |
