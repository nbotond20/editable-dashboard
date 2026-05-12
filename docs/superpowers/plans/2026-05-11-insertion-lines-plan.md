# Insertion Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in magnetic insertion-line drop UI to the headless dashboard library while keeping every existing test passing with default `dropMode: 'classic'`.

**Architecture:** Engine emits a new `insertionLines: InsertionLine[]` array on its snapshot when `dropMode !== 'classic'`. New `DropZone` variants (`insertion-line-h`, `insertion-line-v`) carry pointer-to-line snapping results. Two new `OperationIntent` / `CommittedOperation` variants (`new-row`, `in-row-insert`) reduce to existing `RESIZE_WIDGET` + `REORDER_WIDGETS` actions wrapped in a `BATCH_UPDATE`. Demo (out-of-library) renders the line elements.

**Tech Stack:** TypeScript 5.9, React 18+, Vitest, Playwright, ESLint, Vite 8. See `docs/superpowers/specs/2026-05-11-insertion-lines-design.md` for the full design.

---

## Pre-flight

- [ ] **Read the spec.** `docs/superpowers/specs/2026-05-11-insertion-lines-design.md` is the source of truth for behavior. Re-read sections referenced inline below as you implement.
- [ ] **Verify clean baseline.** Run the test commands once before starting so you know they pass.

```
npm run test
npm run typecheck:lib
npm run lint
```

All three must succeed before any code change. If anything fails, stop and report — do not start the plan.

---

## Task 1: Constants for new config

**Files:**
- Modify: `src/lib/dashboard/constants.ts`

- [ ] **Step 1: Append the two new constants** at the end of `src/lib/dashboard/constants.ts`:

```ts
/** Default drop interaction mode. `'classic'` preserves all pre-line behavior. */
export const DEFAULT_DROP_MODE: "classic" | "lines" | "both" = "classic";

/** Pixel radius around an insertion line that magnetically snaps the pointer. */
export const DEFAULT_LINE_SNAP_RADIUS = 16;

/** Extra pixels the pointer must travel before leaving a snapped line (hysteresis). */
export const LINE_SNAP_HYSTERESIS = 8;
```

- [ ] **Step 2: Type-check.**

```
npm run typecheck:lib
```

Expected: zero errors.

---

## Task 2: New union variants in engine types

**Files:**
- Modify: `src/lib/dashboard/engine/types.ts`

- [ ] **Step 1: Add the `InsertionLine` type** to `src/lib/dashboard/engine/types.ts`. Insert it just below the existing `Point` interface (around line 7):

```ts
export type InsertionLine = {
  id: string;
  orientation: "horizontal" | "vertical";
  x1: number; y1: number; x2: number; y2: number;
  insertionIndex: number;
  beforeId: string | null;
  afterId: string | null;
  rowIndex?: number;
  isActive: boolean;
  disabled: boolean;
};
```

- [ ] **Step 2: Extend the `DropZone` union** (currently lines 81-90) to add two new members:

```ts
export type DropZone =
  | {
      type: "gap";
      beforeId: string | null;
      afterId: string | null;
      index: number;
    }
  | { type: "widget"; targetId: string; side: "left" | "right" }
  | { type: "empty"; column: number }
  | { type: "outside" }
  | {
      type: "insertion-line-h";
      lineId: string;
      insertionIndex: number;
      beforeId: string | null;
      afterId: string | null;
    }
  | {
      type: "insertion-line-v";
      lineId: string;
      insertionIndex: number;
      beforeId: string | null;
      afterId: string | null;
    };
```

- [ ] **Step 3: Extend the `OperationIntent` union** (currently lines 92-104) to add two new members:

```ts
export type OperationIntent =
  | { type: "none" }
  | { type: "reorder"; targetIndex: number }
  | { type: "swap"; targetId: string }
  | {
      type: "auto-resize";
      targetId: string;
      sourceSpan: number;
      targetSpan: number;
      targetIndex: number;
    }
  | { type: "column-pin"; column: number; pointerY?: number; _insertionIndex?: number }
  | { type: "empty-row-maximize"; newSpan: number; pointerY?: number; _insertionIndex?: number }
  | { type: "new-row"; insertionIndex: number; colSpan: number }
  | {
      type: "in-row-insert";
      insertionIndex: number;
      resize: ReadonlyArray<{ id: string; newSpan: number }>;
    };
```

- [ ] **Step 4: Extend `CommittedOperation`** (currently lines 106-129):

```ts
export type CommittedOperation =
  | { type: "reorder"; fromIndex: number; toIndex: number }
  | { type: "swap"; sourceId: string; targetId: string }
  | {
      type: "auto-resize";
      sourceId: string;
      targetId: string;
      sourceSpan: number;
      targetSpan: number;
      targetIndex: number;
    }
  | { type: "column-pin"; sourceId: string; column: number; targetIndex: number }
  | { type: "empty-row-maximize"; sourceId: string; newSpan: number; targetIndex: number }
  | { type: "resize-toggle"; id: string; newSpan: number }
  | {
      type: "external-add";
      widgetType: string;
      colSpan: number;
      targetIndex: number;
      columnStart?: number;
      config?: Record<string, unknown>;
    }
  | { type: "trash"; sourceId: string }
  | { type: "cancelled" }
  | { type: "new-row"; sourceId: string; insertionIndex: number; colSpan: number }
  | {
      type: "in-row-insert";
      sourceId: string;
      insertionIndex: number;
      resize: ReadonlyArray<{ id: string; newSpan: number }>;
    };
```

- [ ] **Step 5: Type-check.**

```
npm run typecheck:lib
```

Expected: errors will surface in `intent-resolver.ts`, `drag-engine.ts`, and `operation-applier.ts` because their `switch (zone.type)` and `switch (operation.type)` are no longer exhaustive. Leave them — they get fixed in later tasks. The fact that TypeScript is now complaining is the proof the new variants are in the unions.

---

## Task 3: Extend DragEngineConfig and DragEngineSnapshot

**Files:**
- Modify: `src/lib/dashboard/engine/types.ts`
- Modify: `src/lib/dashboard/engine/drag-engine.ts`

- [ ] **Step 1: Add `dropMode` + `lineSnapRadius` to `DragEngineConfig`** (currently lines 140-158). Replace the interface with:

```ts
export interface DragEngineConfig {
  activationThreshold: number;
  touchActivationDelay: number;
  touchMoveTolerance: number;
  swapDwellMs: number;
  resizeDwellMs: number;
  emptyRowMaximizeDwellMs: number;
  autoFillMode: "immediate" | "on-drop" | "none";
  maxColumns: number;
  gap: number;
  dropAnimationDuration: number;
  maxUndoDepth: number;
  dropMode: "classic" | "lines" | "both";
  lineSnapRadius: number;
  isPositionLocked: (id: string) => boolean;
  isResizeLocked: (id: string) => boolean;
  canDrop: (sourceId: string, targetIndex: number) => boolean;
  getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number };
  onCommit?: (nextState: DashboardState, prevState: DashboardState, source: CommitSource) => void;
  getTrashRect?: () => { left: number; top: number; right: number; bottom: number } | null;
}
```

- [ ] **Step 2: Add `insertionLines` to `DragEngineSnapshot`** (currently lines 160-172):

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
  insertionLines: InsertionLine[];
}
```

- [ ] **Step 3: Add defaults to `defaultConfig()` in `drag-engine.ts`** (currently lines 68-86). At the top of `drag-engine.ts` (line ~50), add the two new constants to the existing constants import:

Replace:
```ts
import {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  DRAG_ACTIVATION_THRESHOLD,
  TOUCH_DRAG_ACTIVATION_DELAY,
  TOUCH_MOVE_TOLERANCE,
  SWAP_DWELL_MS,
  RESIZE_DWELL_MS,
  EMPTY_ROW_MAXIMIZE_DWELL_MS,
  DROP_ANIMATION_DURATION,
  EXTERNAL_PHANTOM_ID,
} from "../constants.ts";
```

with:
```ts
import {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_GAP,
  DRAG_ACTIVATION_THRESHOLD,
  TOUCH_DRAG_ACTIVATION_DELAY,
  TOUCH_MOVE_TOLERANCE,
  SWAP_DWELL_MS,
  RESIZE_DWELL_MS,
  EMPTY_ROW_MAXIMIZE_DWELL_MS,
  DROP_ANIMATION_DURATION,
  EXTERNAL_PHANTOM_ID,
  DEFAULT_DROP_MODE,
  DEFAULT_LINE_SNAP_RADIUS,
} from "../constants.ts";
```

- [ ] **Step 4: Extend `defaultConfig()`** in `drag-engine.ts`. Replace the function body with:

```ts
function defaultConfig(): DragEngineConfig {
  return {
    activationThreshold: DRAG_ACTIVATION_THRESHOLD,
    touchActivationDelay: TOUCH_DRAG_ACTIVATION_DELAY,
    touchMoveTolerance: TOUCH_MOVE_TOLERANCE,
    swapDwellMs: SWAP_DWELL_MS,
    resizeDwellMs: RESIZE_DWELL_MS,
    emptyRowMaximizeDwellMs: EMPTY_ROW_MAXIMIZE_DWELL_MS,
    autoFillMode: "on-drop",
    maxColumns: DEFAULT_MAX_COLUMNS,
    gap: DEFAULT_GAP,
    dropAnimationDuration: DROP_ANIMATION_DURATION,
    maxUndoDepth: MAX_UNDO_DEPTH,
    dropMode: DEFAULT_DROP_MODE,
    lineSnapRadius: DEFAULT_LINE_SNAP_RADIUS,
    isPositionLocked: () => false,
    isResizeLocked: () => false,
    canDrop: () => true,
    getWidgetConstraints: () => ({ minSpan: 1, maxSpan: Infinity }),
  };
}
```

- [ ] **Step 5: Add a placeholder `insertionLines: []` to `getSnapshot()`.** In `drag-engine.ts` near line 233-254, find the `this.cachedSnapshot = { … }` block and add `insertionLines: [],` as the last property (between `canRedo` and the closing `}`). This makes the snapshot type-correct; we'll populate it for real in Task 11.

```ts
    this.cachedSnapshot = {
      phase,
      layout: this.baseLayout,
      previewLayout: this.previewLayout,
      intent: this.currentIntent,
      zone: this.currentZone,
      dragPosition,
      announcement: this.announcement,
      widgets: state.widgets,
      dwellProgress:
        this.currentZone
          ? computeDwellProgress(
              this.currentZone,
              dwellMs,
              this.config.swapDwellMs,
              this.config.resizeDwellMs,
              this.config.emptyRowMaximizeDwellMs,
            )
          : 0,
      canUndo: canUndo(this.history),
      canRedo: canRedo(this.history),
      insertionLines: [],
    };
```

- [ ] **Step 6: Type-check.**

```
npm run typecheck:lib
```

Expected: same errors as Task 2 in resolvers (still pending). The new fields should not cause new errors.

---

## Task 4: Extend zonesEqual for new variants

**Files:**
- Modify: `src/lib/dashboard/engine/utils.ts`
- Create: `src/lib/dashboard/engine/__tests__/zones-equal-lines.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/dashboard/engine/__tests__/zones-equal-lines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { zonesEqual } from "../utils.ts";
import type { DropZone } from "../types.ts";

describe("zonesEqual — insertion-line zones", () => {
  it("considers two identical insertion-line-h zones equal", () => {
    const a: DropZone = { type: "insertion-line-h", lineId: "h-null-w1-", insertionIndex: 0, beforeId: null, afterId: "w1" };
    const b: DropZone = { type: "insertion-line-h", lineId: "h-null-w1-", insertionIndex: 0, beforeId: null, afterId: "w1" };
    expect(zonesEqual(a, b)).toBe(true);
  });

  it("treats different lineIds as not equal", () => {
    const a: DropZone = { type: "insertion-line-h", lineId: "h-null-w1-", insertionIndex: 0, beforeId: null, afterId: "w1" };
    const b: DropZone = { type: "insertion-line-h", lineId: "h-w1-w2-", insertionIndex: 1, beforeId: "w1", afterId: "w2" };
    expect(zonesEqual(a, b)).toBe(false);
  });

  it("considers two identical insertion-line-v zones equal", () => {
    const a: DropZone = { type: "insertion-line-v", lineId: "v-w1-w2-", insertionIndex: 1, beforeId: "w1", afterId: "w2" };
    const b: DropZone = { type: "insertion-line-v", lineId: "v-w1-w2-", insertionIndex: 1, beforeId: "w1", afterId: "w2" };
    expect(zonesEqual(a, b)).toBe(true);
  });

  it("does not confuse insertion-line-h with insertion-line-v of same id", () => {
    const a: DropZone = { type: "insertion-line-h", lineId: "x", insertionIndex: 0, beforeId: null, afterId: null };
    const b: DropZone = { type: "insertion-line-v", lineId: "x", insertionIndex: 0, beforeId: null, afterId: null };
    expect(zonesEqual(a, b)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

```
npx vitest run src/lib/dashboard/engine/__tests__/zones-equal-lines.test.ts
```

Expected: tests fail because the `switch (a.type)` in `zonesEqual` is non-exhaustive — TypeScript may complain at compile, and the existing implementation returns `false` for unknown variants in the runtime guard.

- [ ] **Step 3: Implement** in `src/lib/dashboard/engine/utils.ts`. Replace the `zonesEqual` switch (lines 14-32) with:

```ts
export function zonesEqual(a: DropZone | null, b: DropZone | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "gap":
      return (
        a.index === (b as typeof a).index &&
        a.beforeId === (b as typeof a).beforeId &&
        a.afterId === (b as typeof a).afterId
      );
    case "widget":
      return a.targetId === (b as typeof a).targetId;
    case "empty":
      return a.column === (b as typeof a).column;
    case "outside":
      return true;
    case "insertion-line-h":
    case "insertion-line-v":
      return a.lineId === (b as typeof a).lineId;
  }
}
```

- [ ] **Step 4: Run tests and confirm pass.**

```
npx vitest run src/lib/dashboard/engine/__tests__/zones-equal-lines.test.ts
```

Expected: all four tests pass.

---

## Task 5: equalDistribute pure function

**Files:**
- Create: `src/lib/dashboard/engine/equal-distribute.ts`
- Create: `src/lib/dashboard/engine/__tests__/equal-distribute.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/dashboard/engine/__tests__/equal-distribute.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { equalDistribute } from "../equal-distribute.ts";

function freeConstraints() {
  return () => ({ minSpan: 1, maxSpan: Infinity });
}
function neverLocked() {
  return () => false;
}

describe("equalDistribute", () => {
  it("returns empty resize when total fits maxColumns", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 1 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 1,
      sourceOriginalSpan: 1,
      maxColumns: 3,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).toEqual({ resize: [] });
  });

  it("equally splits when overflow happens", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 2,
      sourceOriginalSpan: 2,
      maxColumns: 3,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).not.toBeNull();
    const resize = result!.resize.slice().sort((x, y) => x.id.localeCompare(y.id));
    expect(resize).toEqual([
      { id: "a", newSpan: 1 },
      { id: "s", newSpan: 1 },
    ]);
  });

  it("distributes remainder left-to-right (only changed widgets in resize)", () => {
    // 3 widgets in 4 cols: base=1, rem=1 → distribution [2, 1, 1]
    // a was 2, stays 2 (skipped); b was 2 shrinks to 1; s was 2 shrinks to 1
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 2 }],
      sourceId: "s",
      sourceSpan: 2,
      sourceOriginalSpan: 2,
      maxColumns: 4,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).not.toBeNull();
    const resize = result!.resize.slice().sort((x, y) => x.id.localeCompare(y.id));
    expect(resize).toEqual([
      { id: "b", newSpan: 1 },
      { id: "s", newSpan: 1 },
    ]);
  });

  it("returns null when minSpan would be violated", () => {
    // a=2, b=1, s=1 in max=3 → total=4. n=3, base=1, rem=0 → all get 1.
    // a has minSpan=2 → target[a]=1 < 2 → null.
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 1,
      sourceOriginalSpan: 1,
      maxColumns: 3,
      getWidgetConstraints: (id) => (id === "a" ? { minSpan: 2, maxSpan: Infinity } : { minSpan: 1, maxSpan: Infinity }),
      isResizeLocked: neverLocked(),
    });
    expect(result).toBeNull();
  });

  it("returns null when a resize-locked stationary would be shrunk", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 2 }, { id: "b", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 2,
      sourceOriginalSpan: 2,
      maxColumns: 3,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: (id) => id === "a",
    });
    expect(result).toBeNull();
  });

  it("omits resize entries for widgets whose span is unchanged", () => {
    const result = equalDistribute({
      rowSpans: [{ id: "a", colSpan: 1 }],
      sourceId: "s",
      sourceSpan: 1,
      sourceOriginalSpan: 1,
      maxColumns: 2,
      getWidgetConstraints: freeConstraints(),
      isResizeLocked: neverLocked(),
    });
    expect(result).toEqual({ resize: [] });
  });
});
```

- [ ] **Step 2: Run to verify failure.**

```
npx vitest run src/lib/dashboard/engine/__tests__/equal-distribute.test.ts
```

Expected: file does not exist; vitest reports a load error or "module not found".

- [ ] **Step 3: Implement** `src/lib/dashboard/engine/equal-distribute.ts`:

```ts
export interface EqualDistributeInput {
  rowSpans: ReadonlyArray<{ id: string; colSpan: number }>;
  sourceId: string;
  sourceSpan: number;
  sourceOriginalSpan: number;
  maxColumns: number;
  getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number };
  isResizeLocked: (id: string) => boolean;
}

export interface EqualDistributeResult {
  resize: ReadonlyArray<{ id: string; newSpan: number }>;
}

export function equalDistribute(input: EqualDistributeInput): EqualDistributeResult | null {
  const { rowSpans, sourceId, sourceSpan, sourceOriginalSpan, maxColumns, getWidgetConstraints, isResizeLocked } = input;

  const total = rowSpans.reduce((sum, w) => sum + w.colSpan, 0) + sourceSpan;
  if (total <= maxColumns) {
    return { resize: [] };
  }

  const ids: string[] = [...rowSpans.map((w) => w.id), sourceId];
  const originals: number[] = [...rowSpans.map((w) => w.colSpan), sourceOriginalSpan];

  const n = ids.length;
  const base = Math.floor(maxColumns / n);
  const remainder = maxColumns - base * n;
  const targetSpans = ids.map((_, i) => base + (i < remainder ? 1 : 0));

  for (let i = 0; i < n; i++) {
    const c = getWidgetConstraints(ids[i]);
    if (targetSpans[i] < c.minSpan) return null;
    if (targetSpans[i] > c.maxSpan) targetSpans[i] = c.maxSpan;
  }

  const distributed = targetSpans.reduce((sum, s) => sum + s, 0);
  if (distributed > maxColumns) return null;

  for (let i = 0; i < n; i++) {
    if (ids[i] === sourceId) continue;
    if (isResizeLocked(ids[i]) && targetSpans[i] !== originals[i]) return null;
  }

  const resize: Array<{ id: string; newSpan: number }> = [];
  for (let i = 0; i < n; i++) {
    if (targetSpans[i] !== originals[i]) {
      resize.push({ id: ids[i], newSpan: targetSpans[i] });
    }
  }

  return { resize };
}
```

- [ ] **Step 4: Run tests and confirm pass.**

```
npx vitest run src/lib/dashboard/engine/__tests__/equal-distribute.test.ts
```

Expected: all six tests pass.

---

## Task 6: computeInsertionLines pure function

**Files:**
- Create: `src/lib/dashboard/engine/insertion-lines.ts`
- Create: `src/lib/dashboard/engine/__tests__/insertion-lines.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/dashboard/engine/__tests__/insertion-lines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeInsertionLines } from "../insertion-lines.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";

function layout(
  positions: Array<{ id: string; x: number; y: number; width: number; height: number; colSpan: number }>,
  totalHeight?: number
): ComputedLayout {
  const map = new Map(
    positions.map((p) => [p.id, { id: p.id, x: p.x, y: p.y, width: p.width, height: p.height, colSpan: p.colSpan }])
  );
  return {
    positions: map,
    totalHeight: totalHeight ?? Math.max(0, ...positions.map((p) => p.y + p.height)),
  };
}

function widgets(ids: string[]): WidgetState[] {
  return ids.map((id, i) => ({ id, type: "x", colSpan: 1, visible: true, order: i }));
}

const CONFIG = {
  maxColumns: 3,
  containerWidth: 800,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
};

describe("computeInsertionLines", () => {
  it("returns empty array in classic mode", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 }]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a"]),
      sourceId: "a",
      dropMode: "classic",
      ...CONFIG,
    });
    expect(result).toEqual([]);
  });

  it("returns empty array when source is position-locked", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 }]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a"]),
      sourceId: "a",
      dropMode: "lines",
      ...CONFIG,
      isPositionLocked: (id) => id === "a",
    });
    expect(result).toEqual([]);
  });

  it("emits 4 V-lines + 2 H-lines for a single-row layout with 3 stationaries", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "c", x: 544, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a", "b", "c", "src"]),
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const h = result.filter((l) => l.orientation === "horizontal");
    const v = result.filter((l) => l.orientation === "vertical");
    expect(h.length).toBe(2);
    expect(v.length).toBe(4);
  });

  it("emits no V-lines in 1-column mode", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 800, height: 100, colSpan: 1 },
      { id: "b", x: 0, y: 116, width: 800, height: 100, colSpan: 1 },
    ]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a", "b", "src"]),
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
      maxColumns: 1,
    });
    expect(result.every((l) => l.orientation === "horizontal")).toBe(true);
    expect(result.length).toBe(3);
  });

  it("emits one H-line at top when dashboard is empty", () => {
    const result = computeInsertionLines({
      layout: layout([]),
      widgets: [],
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    expect(result.length).toBe(1);
    expect(result[0].orientation).toBe("horizontal");
  });

  it("flags self-adjacent V-lines as disabled", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const allWidgets: WidgetState[] = [
      { id: "src", type: "x", colSpan: 1, visible: true, order: 0 },
      { id: "a", type: "x", colSpan: 1, visible: true, order: 1 },
      { id: "b", type: "x", colSpan: 1, visible: true, order: 2 },
    ];
    const result = computeInsertionLines({
      layout: lay,
      widgets: allWidgets,
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const lineBeforeA = result.find((l) => l.orientation === "vertical" && l.beforeId === null && l.afterId === "a");
    expect(lineBeforeA?.disabled).toBe(true);
  });

  it("emits stable ids derived from before/after ids and rowIndex", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, width: 256, height: 100, colSpan: 1 },
      { id: "b", x: 272, y: 0, width: 256, height: 100, colSpan: 1 },
    ]);
    const result = computeInsertionLines({
      layout: lay,
      widgets: widgets(["a", "b", "src"]),
      sourceId: "src",
      dropMode: "lines",
      ...CONFIG,
    });
    const ids = result.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

```
npx vitest run src/lib/dashboard/engine/__tests__/insertion-lines.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement** `src/lib/dashboard/engine/insertion-lines.ts`:

```ts
import type { ComputedLayout, WidgetState } from "../types.ts";
import type { InsertionLine } from "./types.ts";

export interface ComputeInsertionLinesInput {
  layout: ComputedLayout;
  widgets: readonly WidgetState[];
  sourceId: string | null;
  dropMode: "classic" | "lines" | "both";
  maxColumns: number;
  containerWidth: number;
  isPositionLocked: (id: string) => boolean;
  isResizeLocked: (id: string) => boolean;
}

interface PositionedWidget {
  id: string;
  order: number;
  colSpan: number;
  x: number; y: number; width: number; height: number;
}

export function computeInsertionLines(input: ComputeInsertionLinesInput): InsertionLine[] {
  const { layout, widgets, sourceId, dropMode, maxColumns, containerWidth, isPositionLocked, isResizeLocked } = input;

  if (dropMode === "classic") return [];
  if (sourceId != null && isPositionLocked(sourceId)) return [];

  const stationaries: PositionedWidget[] = [];
  for (const w of widgets) {
    if (!w.visible) continue;
    if (sourceId != null && w.id === sourceId) continue;
    const pos = layout.positions.get(w.id);
    if (!pos) continue;
    stationaries.push({
      id: w.id,
      order: w.order,
      colSpan: w.colSpan,
      x: pos.x, y: pos.y, width: pos.width, height: pos.height,
    });
  }
  stationaries.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  if (stationaries.length === 0) {
    return [
      {
        id: "h-null-null-0",
        orientation: "horizontal",
        x1: 0, y1: 0, x2: containerWidth, y2: 0,
        insertionIndex: 0,
        beforeId: null,
        afterId: null,
        rowIndex: 0,
        isActive: false,
        disabled: false,
      },
    ];
  }

  const rows: PositionedWidget[][] = [];
  for (const w of stationaries) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - w.y) < 1) {
      last.push(w);
    } else {
      rows.push([w]);
    }
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);

  const includedSorted = widgets
    .filter((w) => w.visible)
    .slice()
    .sort((a, b) => a.order - b.order);
  const sourceIncludedIdx = sourceId != null ? includedSorted.findIndex((w) => w.id === sourceId) : -1;
  const excludedSorted = sourceId != null
    ? includedSorted.filter((w) => w.id !== sourceId)
    : includedSorted;

  function widgetsArrayIndex(beforeId: string | null, afterId: string | null): number {
    if (beforeId == null && afterId == null) return 0;
    if (afterId != null) {
      const idx = excludedSorted.findIndex((w) => w.id === afterId);
      return idx === -1 ? excludedSorted.length : idx;
    }
    return excludedSorted.length;
  }

  function selfAdjacent(insertionIndex: number): boolean {
    return sourceIncludedIdx >= 0 && insertionIndex === sourceIncludedIdx;
  }

  const lines: InsertionLine[] = [];
  const gap = stationaries.length > 1
    ? Math.max(0, (rows[0].length > 1 ? rows[0][1].x - (rows[0][0].x + rows[0][0].width) : 16))
    : 16;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const yTop = Math.min(...row.map((w) => w.y));
    const yBottom = Math.max(...row.map((w) => w.y + w.height));

    if (maxColumns > 1) {
      const first = row[0];
      const outerLeftX = first.x;
      const beforeId = null;
      const afterId = first.id;
      const insertionIndex = widgetsArrayIndex(beforeId, afterId);
      lines.push({
        id: `v-${beforeId ?? "start"}-${afterId ?? "end"}-${r}`,
        orientation: "vertical",
        x1: outerLeftX, y1: yTop, x2: outerLeftX, y2: yBottom,
        insertionIndex,
        beforeId, afterId,
        isActive: false,
        disabled: selfAdjacent(insertionIndex),
      });

      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i];
        const b = row[i + 1];
        const midX = (a.x + a.width + b.x) / 2;
        const bId = a.id;
        const aId = b.id;
        const idx = widgetsArrayIndex(bId, aId);
        const disabled =
          selfAdjacent(idx) ||
          isResizeLockedRow(row, sourceId, isResizeLocked, maxColumns);
        lines.push({
          id: `v-${bId}-${aId}-${r}`,
          orientation: "vertical",
          x1: midX, y1: yTop, x2: midX, y2: yBottom,
          insertionIndex: idx,
          beforeId: bId,
          afterId: aId,
          isActive: false,
          disabled,
        });
      }

      const last = row[row.length - 1];
      const outerRightX = last.x + last.width;
      const beforeIdR = last.id;
      const afterIdR = null;
      const insertionIndexR = widgetsArrayIndex(beforeIdR, afterIdR);
      lines.push({
        id: `v-${beforeIdR}-${afterIdR ?? "end"}-${r}`,
        orientation: "vertical",
        x1: outerRightX, y1: yTop, x2: outerRightX, y2: yBottom,
        insertionIndex: insertionIndexR,
        beforeId: beforeIdR,
        afterId: afterIdR,
        isActive: false,
        disabled: selfAdjacent(insertionIndexR),
      });
    }
  }

  for (let r = 0; r <= rows.length; r++) {
    let y: number;
    let beforeId: string | null;
    let afterId: string | null;
    if (r === 0) {
      y = Math.max(0, rows[0][0].y - gap / 2);
      beforeId = null;
      afterId = rows[0][0].id;
    } else if (r === rows.length) {
      const lastRow = rows[r - 1];
      const lastBottom = Math.max(...lastRow.map((w) => w.y + w.height));
      y = lastBottom + gap / 2;
      beforeId = lastRow[lastRow.length - 1].id;
      afterId = null;
    } else {
      const above = rows[r - 1];
      const below = rows[r];
      const aboveBottom = Math.max(...above.map((w) => w.y + w.height));
      const belowTop = Math.min(...below.map((w) => w.y));
      y = (aboveBottom + belowTop) / 2;
      beforeId = above[above.length - 1].id;
      afterId = below[0].id;
    }
    const insertionIndex = widgetsArrayIndex(beforeId, afterId);
    lines.push({
      id: `h-${beforeId ?? "start"}-${afterId ?? "end"}-${r}`,
      orientation: "horizontal",
      x1: 0, y1: y, x2: containerWidth, y2: y,
      insertionIndex,
      beforeId, afterId,
      rowIndex: r,
      isActive: false,
      disabled: selfAdjacent(insertionIndex),
    });
  }

  return lines;
}

function isResizeLockedRow(
  row: ReadonlyArray<{ id: string; colSpan: number }>,
  sourceId: string | null,
  isResizeLocked: (id: string) => boolean,
  maxColumns: number,
): boolean {
  const totalRowSpan = row.reduce((sum, w) => sum + w.colSpan, 0);
  const sourceContributesSpan = 1;
  if (totalRowSpan + sourceContributesSpan <= maxColumns) return false;
  return row.some((w) => w.id !== sourceId && isResizeLocked(w.id));
}
```

> Note: `isResizeLockedRow` is a conservative pre-filter using `sourceContributesSpan = 1`. The real check happens in `equalDistribute` during intent resolution; this helper just flags lines where any resize-locked widget exists in a row that would need shrinking. False positives are fine — the intent resolver will be authoritative.

- [ ] **Step 4: Run tests and confirm pass.**

```
npx vitest run src/lib/dashboard/engine/__tests__/insertion-lines.test.ts
```

Expected: all seven tests pass.

---

## Task 7: findSnappedLine with magnetism + hysteresis

**Files:**
- Modify: `src/lib/dashboard/engine/insertion-lines.ts`
- Create: `src/lib/dashboard/engine/__tests__/find-snapped-line.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/dashboard/engine/__tests__/find-snapped-line.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findSnappedLine } from "../insertion-lines.ts";
import type { InsertionLine } from "../types.ts";

function vLine(id: string, x: number, y1: number, y2: number, disabled = false): InsertionLine {
  return {
    id, orientation: "vertical",
    x1: x, y1, x2: x, y2,
    insertionIndex: 0,
    beforeId: null, afterId: null,
    isActive: false, disabled,
  };
}

function hLine(id: string, y: number, x1: number, x2: number): InsertionLine {
  return {
    id, orientation: "horizontal",
    x1, y1: y, x2, y2: y,
    insertionIndex: 0,
    beforeId: null, afterId: null,
    isActive: false, disabled: false,
  };
}

describe("findSnappedLine", () => {
  it("returns null when no lines are within snap radius", () => {
    const lines = [vLine("v1", 100, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 200, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result).toBeNull();
  });

  it("snaps to the closest V-line within the radius", () => {
    const lines = [vLine("v1", 100, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 110, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result?.id).toBe("v1");
  });

  it("returns null when the pointer is above/below a V-line segment beyond the snap radius", () => {
    const lines = [vLine("v1", 100, 100, 200)];
    const result = findSnappedLine({ pointer: { x: 110, y: 50 }, lines, snapRadius: 16, previousLineId: null });
    expect(result).toBeNull();
  });

  it("skips disabled lines", () => {
    const lines = [vLine("v1", 100, 0, 200, true)];
    const result = findSnappedLine({ pointer: { x: 110, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result).toBeNull();
  });

  it("picks the closest of two competing lines", () => {
    const lines = [vLine("v1", 100, 0, 200), vLine("v2", 130, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 125, y: 100 }, lines, snapRadius: 16, previousLineId: null });
    expect(result?.id).toBe("v2");
  });

  it("applies hysteresis: keeps the previous line when within exit radius", () => {
    const lines = [vLine("v1", 100, 0, 200), vLine("v2", 130, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 120, y: 100 }, lines, snapRadius: 16, previousLineId: "v1" });
    expect(result?.id).toBe("v1");
  });

  it("releases the previous line once past exit threshold", () => {
    const lines = [vLine("v1", 100, 0, 200), vLine("v2", 130, 0, 200)];
    const result = findSnappedLine({ pointer: { x: 125, y: 100 }, lines, snapRadius: 16, previousLineId: "v1" });
    expect(result?.id).toBe("v2");
  });

  it("snaps to H-lines using perpendicular distance", () => {
    const lines = [hLine("h1", 50, 0, 800)];
    const result = findSnappedLine({ pointer: { x: 400, y: 60 }, lines, snapRadius: 16, previousLineId: null });
    expect(result?.id).toBe("h1");
  });
});
```

- [ ] **Step 2: Run to verify failure.**

```
npx vitest run src/lib/dashboard/engine/__tests__/find-snapped-line.test.ts
```

Expected: `findSnappedLine` does not exist; import error.

- [ ] **Step 3: Add the function** to `src/lib/dashboard/engine/insertion-lines.ts`. Append at the bottom:

```ts
import type { Point } from "./types.ts";
import { LINE_SNAP_HYSTERESIS } from "../constants.ts";

export interface FindSnappedLineInput {
  pointer: Point;
  lines: ReadonlyArray<InsertionLine>;
  snapRadius: number;
  previousLineId: string | null;
}

export function findSnappedLine(input: FindSnappedLineInput): InsertionLine | null {
  const { pointer, lines, snapRadius, previousLineId } = input;

  let best: InsertionLine | null = null;
  let bestDist = Infinity;
  let previousLine: InsertionLine | null = null;
  let previousDist = Infinity;

  for (const line of lines) {
    if (line.disabled) continue;
    const dist = pointerLineDistance(pointer, line);
    if (line.id === previousLineId) {
      previousLine = line;
      previousDist = dist;
    }
    if (dist <= snapRadius && dist < bestDist) {
      best = line;
      bestDist = dist;
    }
  }

  if (previousLine && previousDist <= snapRadius + LINE_SNAP_HYSTERESIS) {
    if (!best || previousDist <= bestDist) {
      return previousLine;
    }
  }

  return best;
}

function pointerLineDistance(p: Point, line: InsertionLine): number {
  if (line.orientation === "vertical") {
    if (p.y >= line.y1 && p.y <= line.y2) {
      return Math.abs(p.x - line.x1);
    }
    const dy = p.y < line.y1 ? line.y1 - p.y : p.y - line.y2;
    return Math.hypot(p.x - line.x1, dy);
  } else {
    if (p.x >= line.x1 && p.x <= line.x2) {
      return Math.abs(p.y - line.y1);
    }
    const dx = p.x < line.x1 ? line.x1 - p.x : p.x - line.x2;
    return Math.hypot(dx, p.y - line.y1);
  }
}
```

- [ ] **Step 4: Run tests and confirm pass.**

```
npx vitest run src/lib/dashboard/engine/__tests__/find-snapped-line.test.ts
```

Expected: all eight tests pass.

- [ ] **Step 5: Re-run all engine tests** so existing tests still pass alongside the new ones.

```
npx vitest run src/lib/dashboard/engine
```

Expected: all engine tests pass.

---

## Task 8: Extend resolveZone with mode-aware line snapping

**Files:**
- Modify: `src/lib/dashboard/engine/zone-resolver.ts`
- Create: `src/lib/dashboard/engine/__tests__/zone-resolver-lines.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/dashboard/engine/__tests__/zone-resolver-lines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveZone } from "../zone-resolver.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";
import type { InsertionLine } from "../types.ts";

function layout(specs: Array<{ id: string; x: number; y: number; width: number; height: number }>): ComputedLayout {
  return {
    positions: new Map(specs.map((s) => [s.id, { id: s.id, x: s.x, y: s.y, width: s.width, height: s.height, colSpan: 1 }])),
    totalHeight: Math.max(0, ...specs.map((s) => s.y + s.height)),
  };
}

function widgets(ids: string[]): WidgetState[] {
  return ids.map((id, i) => ({ id, type: "x", colSpan: 1, visible: true, order: i }));
}

const STD = { gap: 16, maxColumns: 3, containerWidth: 800 };

describe("resolveZone — mode-aware line snapping", () => {
  it("returns widget zone for pointer inside widget interior even when lines are provided", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [];
    const zone = resolveZone(
      { x: 128, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "lines", lines, 16, null
    );
    expect(zone.type).toBe("widget");
  });

  it("returns insertion-line-v when pointer snaps to a V-line in lines mode", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [
      {
        id: "v-a-end-0",
        orientation: "vertical",
        x1: 256, y1: 0, x2: 256, y2: 100,
        insertionIndex: 1,
        beforeId: "a",
        afterId: null,
        isActive: false,
        disabled: false,
      },
    ];
    const zone = resolveZone(
      { x: 260, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "lines", lines, 16, null
    );
    expect(zone).toEqual({
      type: "insertion-line-v",
      lineId: "v-a-end-0",
      insertionIndex: 1,
      beforeId: "a",
      afterId: null,
    });
  });

  it("collapses non-widget zones to outside in lines mode when no line snaps", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [];
    const zone = resolveZone(
      { x: 400, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "lines", lines, 16, null
    );
    expect(zone.type).toBe("outside");
  });

  it("falls back to classic resolver in 'both' mode when no line snaps", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [];
    const zone = resolveZone(
      { x: 400, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "both", lines, 16, null
    );
    expect(zone.type).not.toBe("outside");
  });

  it("ignores lines entirely in classic mode", () => {
    const lay = layout([{ id: "a", x: 0, y: 0, width: 256, height: 100 }]);
    const lines: InsertionLine[] = [
      {
        id: "v-a-end-0",
        orientation: "vertical",
        x1: 256, y1: 0, x2: 256, y2: 100,
        insertionIndex: 1,
        beforeId: "a", afterId: null,
        isActive: false, disabled: false,
      },
    ];
    const zone = resolveZone(
      { x: 260, y: 50 },
      lay, widgets(["a"]), STD.gap, STD.maxColumns, STD.containerWidth,
      null, undefined, "classic", lines, 16, null
    );
    expect(zone.type).not.toBe("insertion-line-v");
  });
});
```

- [ ] **Step 2: Run to verify failure.**

```
npx vitest run src/lib/dashboard/engine/__tests__/zone-resolver-lines.test.ts
```

Expected: existing `resolveZone` signature does not accept the extra args; TypeScript/runtime errors.

- [ ] **Step 3: Update the `resolveZone` signature and logic** in `src/lib/dashboard/engine/zone-resolver.ts`. Replace the top of the function (lines 12-21):

```ts
import type { Point, DropZone, InsertionLine } from "./types.ts";
import type { ComputedLayout, WidgetState } from "../types.ts";
import { findSnappedLine } from "./insertion-lines.ts";

type WidgetRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function resolveZone(
  pointer: Point,
  layout: ComputedLayout,
  widgets: WidgetState[],
  gap: number,
  maxColumns: number,
  containerWidth: number,
  sourceId: string | null,
  currentWidgetSide?: "left" | "right",
  dropMode: "classic" | "lines" | "both" = "classic",
  insertionLines: ReadonlyArray<InsertionLine> = [],
  lineSnapRadius = 16,
  previousLineId: string | null = null,
): DropZone {
  const rects = buildRects(layout, widgets, sourceId);
  const inset = gap / 2;
  const colWidth =
    maxColumns > 1
      ? (containerWidth - gap * (maxColumns - 1)) / maxColumns
      : containerWidth;

  if (dropMode !== "classic") {
    const widgetHit = resolveWidgetHit(pointer, rects, inset, colWidth, currentWidgetSide);
    if (widgetHit) return widgetHit;

    const snapped = findSnappedLine({ pointer, lines: insertionLines, snapRadius: lineSnapRadius, previousLineId });
    if (snapped) {
      return {
        type: snapped.orientation === "horizontal" ? "insertion-line-h" : "insertion-line-v",
        lineId: snapped.id,
        insertionIndex: snapped.insertionIndex,
        beforeId: snapped.beforeId,
        afterId: snapped.afterId,
      };
    }

    if (dropMode === "lines") return { type: "outside" };
  }

  return classicResolveZone(pointer, rects, layout, widgets, gap, maxColumns, containerWidth, inset, colWidth, currentWidgetSide);
}
```

> Note: the classic body of the original `resolveZone` is being moved into a helper called `classicResolveZone`. The existing `widgetHit` and `emptyZone` helpers below stay as-is.

- [ ] **Step 4: Extract the classic body** into `classicResolveZone`. After the new top function, rename the previous body to:

```ts
function classicResolveZone(
  pointer: Point,
  rects: WidgetRect[],
  layout: ComputedLayout,
  widgets: WidgetState[],
  gap: number,
  maxColumns: number,
  containerWidth: number,
  inset: number,
  colWidth: number,
  currentWidgetSide?: "left" | "right",
): DropZone {
  const widgetHit = resolveWidgetHit(pointer, rects, inset, colWidth, currentWidgetSide);
  if (widgetHit) return widgetHit;

  if (rects.length > 0) {
    const first = rects[0];
    if (isInGapBefore(pointer, first, inset)) {
      return { type: "gap", beforeId: null, afterId: first.id, index: 0 };
    }
  }

  const step = colWidth + gap;
  const pointerCol = Math.min(
    Math.max(0, Math.floor(pointer.x / step)),
    maxColumns - 1,
  );

  for (let i = 0; i < rects.length - 1; i++) {
    const current = rects[i];
    const next = rects[i + 1];
    if (isInGapBetween(pointer, current, next, inset, containerWidth)) {
      const curEndCol = Math.ceil((current.x + current.width) / step);
      if (pointerCol >= curEndCol) {
        const colOccupied = Array.from(layout.positions.values()).some(pos => {
          const posCol = Math.round(pos.x / step);
          const posSpan = Math.max(1, Math.round((pos.width + gap) / step));
          return pointerCol >= posCol && pointerCol < posCol + posSpan;
        });
        if (colOccupied) continue;
      }
      return {
        type: "gap",
        beforeId: current.id,
        afterId: next.id,
        index: i + 1,
      };
    }
  }

  if (rects.length > 0) {
    const first = rects[0];
    if (
      pointer.y >= 0 &&
      pointer.y < first.y &&
      pointer.x >= first.x &&
      pointer.x < first.x + first.width &&
      !Array.from(layout.positions.values()).some(pos => pointer.y >= pos.y)
    ) {
      return { type: "gap", beforeId: null, afterId: first.id, index: 0 };
    }
  }

  const emptyZone = resolveEmptyZone(pointer, layout, colWidth, gap, maxColumns, containerWidth);
  if (emptyZone) return emptyZone;

  if (rects.length > 0) {
    const last = rects[rects.length - 1];
    if (isInGapAfter(pointer, last, inset, layout.totalHeight, containerWidth)) {
      return { type: "gap", beforeId: last.id, afterId: null, index: rects.length };
    }
  }

  if (
    pointer.y >= layout.totalHeight &&
    pointer.x >= 0 &&
    pointer.x < containerWidth
  ) {
    const column = Math.min(Math.floor(pointer.x / (colWidth + gap)), maxColumns - 1);
    return { type: "empty", column: Math.max(0, column) };
  }

  if (
    maxColumns > 1 &&
    rects.length > 0 &&
    pointer.x >= containerWidth &&
    pointer.x < containerWidth + gap
  ) {
    const last = rects[rects.length - 1];
    if (pointer.y >= last.y && pointer.y < last.y + last.height) {
      return { type: "gap", beforeId: last.id, afterId: null, index: rects.length };
    }
  }

  return { type: "outside" };
}
```

The helpers `buildRects`, `resolveWidgetHit`, `resolveEmptyZone`, `isInGapBefore`, `isInGapBetween`, `isInGapAfter` remain unchanged from the original file.

- [ ] **Step 5: Run new + existing zone-resolver tests.**

```
npx vitest run src/lib/dashboard/engine/__tests__/zone-resolver.test.ts src/lib/dashboard/engine/__tests__/zone-resolver-lines.test.ts
```

Expected: all tests pass — old tests still call `resolveZone(...)` with the original 8 args, picking up `dropMode = 'classic'` default which falls straight through to `classicResolveZone`.

---

## Task 9: Extend resolveIntent for insertion-line zones

**Files:**
- Modify: `src/lib/dashboard/engine/intent-resolver.ts`
- Create: `src/lib/dashboard/engine/__tests__/intent-resolver-lines.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/dashboard/engine/__tests__/intent-resolver-lines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveIntent } from "../intent-resolver.ts";
import type { ComputedLayout, WidgetState } from "../../types.ts";
import type { DropZone } from "../types.ts";

function widget(id: string, colSpan = 1, order = 0): WidgetState {
  return { id, type: "x", colSpan, visible: true, order };
}

function layout(specs: Array<{ id: string; x: number; y: number; w: number; h: number }>): ComputedLayout {
  return {
    positions: new Map(specs.map((s) => [s.id, { id: s.id, x: s.x, y: s.y, width: s.w, height: s.h, colSpan: 1 }])),
    totalHeight: Math.max(0, ...specs.map((s) => s.y + s.h)),
  };
}

const CFG = {
  swapDwellMs: 0,
  resizeDwellMs: 600,
  emptyRowMaximizeDwellMs: 600,
  maxColumns: 3,
  isPositionLocked: () => false,
  isResizeLocked: () => false,
  canDrop: () => true,
  getWidgetConstraints: () => ({ minSpan: 1, maxSpan: 3 }),
};

describe("resolveIntent — insertion-line zones", () => {
  it("returns new-row intent for insertion-line-h with maxColumns colSpan", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 1,
      beforeId: "a", afterId: "b",
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a"), widget("b")], CFG);
    expect(result).toEqual({ type: "new-row", insertionIndex: 1, colSpan: 3 });
  });

  it("clamps new-row colSpan to source maxSpan", () => {
    const zone: DropZone = {
      type: "insertion-line-h",
      lineId: "h",
      insertionIndex: 0,
      beforeId: null, afterId: "a",
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a")], {
      ...CFG,
      getWidgetConstraints: (id) => (id === "src" ? { minSpan: 1, maxSpan: 2 } : { minSpan: 1, maxSpan: 3 }),
    });
    expect(result).toEqual({ type: "new-row", insertionIndex: 0, colSpan: 2 });
  });

  it("returns in-row-insert with empty resize when row fits without resize", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 256, h: 100 },
    ]);
    const zone: DropZone = {
      type: "insertion-line-v",
      lineId: "v",
      insertionIndex: 1,
      beforeId: "a", afterId: null,
    };
    const source = widget("src", 1, 5);
    const result = resolveIntent(zone, 0, source, [widget("a", 1, 0)], { ...CFG, layout: lay });
    expect(result).toEqual({ type: "in-row-insert", insertionIndex: 1, resize: [] });
  });

  it("returns in-row-insert with resize when row overflows", () => {
    // Row: a(2), b(1). Source s(2). maxCols=3. Total=5>3.
    // equalDistribute n=3, base=1, rem=0. All get 1.
    // a was 2 → 1 (change). b was 1 → 1 (no change, skipped). s was 2 → 1 (change).
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 512, h: 100 },
      { id: "b", x: 528, y: 0, w: 256, h: 100 },
    ]);
    const zone: DropZone = {
      type: "insertion-line-v",
      lineId: "v",
      insertionIndex: 1,
      beforeId: "a", afterId: "b",
    };
    const source = widget("src", 2, 5);
    const result = resolveIntent(zone, 0, source, [widget("a", 2, 0), widget("b", 1, 1)], { ...CFG, layout: lay });
    expect(result.type).toBe("in-row-insert");
    if (result.type === "in-row-insert") {
      const ids = result.resize.map((r) => r.id).sort();
      expect(ids).toEqual(["a", "src"]);
      expect(result.resize.every((r) => r.newSpan === 1)).toBe(true);
      expect(result.insertionIndex).toBe(1);
    }
  });

  it("returns none when equal-distribute is infeasible", () => {
    const lay = layout([
      { id: "a", x: 0, y: 0, w: 512, h: 100 },
      { id: "b", x: 528, y: 0, w: 256, h: 100 },
    ]);
    const zone: DropZone = {
      type: "insertion-line-v",
      lineId: "v",
      insertionIndex: 1,
      beforeId: "a", afterId: "b",
    };
    const source = widget("src", 2, 5);
    const result = resolveIntent(zone, 0, source, [widget("a", 2, 0), widget("b", 1, 1)], {
      ...CFG, layout: lay,
      getWidgetConstraints: (id) => (id === "a" ? { minSpan: 2, maxSpan: 3 } : { minSpan: 1, maxSpan: 3 }),
    });
    expect(result).toEqual({ type: "none" });
  });
});
```

- [ ] **Step 2: Run to verify failure.**

```
npx vitest run src/lib/dashboard/engine/__tests__/intent-resolver-lines.test.ts
```

Expected: `resolveIntent` switch isn't handling new zone types — returns nothing for the new cases.

- [ ] **Step 3: Add the cases** in `src/lib/dashboard/engine/intent-resolver.ts`. Inside the `switch (zone.type)` block in `resolveIntent` (around line 25 onward), add two more cases just before the `case "outside"`:

```ts
    case "insertion-line-h": {
      const constraints = config.getWidgetConstraints(sourceWidget.id);
      const colSpan = Math.min(config.maxColumns, constraints.maxSpan);
      return { type: "new-row", insertionIndex: zone.insertionIndex, colSpan };
    }

    case "insertion-line-v": {
      const row = findRowForLine(zone, widgets, config.layout, sourceWidget.id);
      if (!row) return { type: "none" };

      const result = equalDistribute({
        rowSpans: row.map((w) => ({ id: w.id, colSpan: w.colSpan })),
        sourceId: sourceWidget.id,
        sourceSpan: sourceWidget.colSpan,
        sourceOriginalSpan: sourceWidget.colSpan,
        maxColumns: config.maxColumns,
        getWidgetConstraints: config.getWidgetConstraints,
        isResizeLocked: config.isResizeLocked,
      });

      if (!result) return { type: "none" };

      return {
        type: "in-row-insert",
        insertionIndex: zone.insertionIndex,
        resize: result.resize,
      };
    }
```

- [ ] **Step 4: Add the `findRowForLine` helper and the import** in the same file. At the top, add:

```ts
import { equalDistribute } from "./equal-distribute.ts";
```

At the bottom (above the existing `isEmptyRow`):

```ts
function findRowForLine(
  zone: Extract<DropZone, { type: "insertion-line-v" }>,
  widgets: readonly WidgetState[],
  layout: ComputedLayout | undefined,
  sourceId: string,
): WidgetState[] | null {
  if (!layout) return null;

  const anchorId = zone.beforeId ?? zone.afterId;
  if (anchorId == null) return null;

  const anchorPos = layout.positions.get(anchorId);
  if (!anchorPos) return null;

  const row: WidgetState[] = [];
  for (const w of widgets) {
    if (!w.visible) continue;
    if (w.id === sourceId) continue;
    const pos = layout.positions.get(w.id);
    if (!pos) continue;
    if (Math.abs(pos.y - anchorPos.y) < 1) {
      row.push(w);
    }
  }
  return row;
}
```

- [ ] **Step 5: Run intent tests.**

```
npx vitest run src/lib/dashboard/engine/__tests__/intent-resolver.test.ts src/lib/dashboard/engine/__tests__/intent-resolver-lines.test.ts
```

Expected: all tests in both files pass.

---

## Task 10: Operation applier handles new-row and in-row-insert

**Files:**
- Modify: `src/lib/dashboard/engine/operation-applier.ts`
- Create: `src/lib/dashboard/engine/__tests__/operation-applier-lines.test.ts`

- [ ] **Step 1: Write the failing test** at `src/lib/dashboard/engine/__tests__/operation-applier-lines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyOperation } from "../operation-applier.ts";
import type { DashboardState, WidgetState } from "../../types.ts";

function makeState(specs: Array<{ id: string; colSpan: number; order: number }>): DashboardState {
  return {
    widgets: specs.map(
      (s): WidgetState => ({ id: s.id, type: "x", colSpan: s.colSpan, visible: true, order: s.order })
    ),
    maxColumns: 3,
    gap: 16,
    containerWidth: 800,
  };
}

function sortedIds(state: DashboardState): string[] {
  return state.widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order)
    .map((w) => w.id);
}

describe("applyOperation — new-row + in-row-insert", () => {
  it("new-row moves source and resizes to colSpan", () => {
    const state = makeState([
      { id: "a", colSpan: 1, order: 0 },
      { id: "src", colSpan: 1, order: 1 },
      { id: "b", colSpan: 1, order: 2 },
    ]);
    const result = applyOperation(state, {
      type: "new-row",
      sourceId: "src",
      insertionIndex: 0,
      colSpan: 3,
    });
    expect(sortedIds(result)).toEqual(["src", "a", "b"]);
    expect(result.widgets.find((w) => w.id === "src")!.colSpan).toBe(3);
  });

  it("new-row does not resize when colSpan unchanged", () => {
    const state = makeState([
      { id: "a", colSpan: 1, order: 0 },
      { id: "src", colSpan: 3, order: 1 },
    ]);
    const result = applyOperation(state, {
      type: "new-row",
      sourceId: "src",
      insertionIndex: 0,
      colSpan: 3,
    });
    expect(sortedIds(result)).toEqual(["src", "a"]);
    expect(result.widgets.find((w) => w.id === "src")!.colSpan).toBe(3);
  });

  it("in-row-insert applies all resizes and reorders source", () => {
    const state = makeState([
      { id: "a", colSpan: 2, order: 0 },
      { id: "b", colSpan: 1, order: 1 },
      { id: "src", colSpan: 2, order: 2 },
    ]);
    const result = applyOperation(state, {
      type: "in-row-insert",
      sourceId: "src",
      insertionIndex: 1,
      resize: [
        { id: "a", newSpan: 1 },
        { id: "b", newSpan: 1 },
        { id: "src", newSpan: 1 },
      ],
    });
    expect(sortedIds(result)).toEqual(["a", "src", "b"]);
    expect(result.widgets.find((w) => w.id === "a")!.colSpan).toBe(1);
    expect(result.widgets.find((w) => w.id === "b")!.colSpan).toBe(1);
    expect(result.widgets.find((w) => w.id === "src")!.colSpan).toBe(1);
  });

  it("in-row-insert without any resize still reorders", () => {
    const state = makeState([
      { id: "a", colSpan: 1, order: 0 },
      { id: "b", colSpan: 1, order: 1 },
      { id: "src", colSpan: 1, order: 2 },
    ]);
    const result = applyOperation(state, {
      type: "in-row-insert",
      sourceId: "src",
      insertionIndex: 1,
      resize: [],
    });
    expect(sortedIds(result)).toEqual(["a", "src", "b"]);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

```
npx vitest run src/lib/dashboard/engine/__tests__/operation-applier-lines.test.ts
```

Expected: switch in `applyOperation` returns nothing for new variants; tests fail.

- [ ] **Step 3: Add the cases** in `src/lib/dashboard/engine/operation-applier.ts`. Insert before `case "cancelled"`:

```ts
    case "new-row": {
      let result = state;
      if (operation.colSpan !== getColSpan(state, operation.sourceId)) {
        result = dashboardReducer(result, {
          type: "RESIZE_WIDGET",
          id: operation.sourceId,
          colSpan: operation.colSpan,
        });
      }
      const visibleSorted = getVisibleSorted(result.widgets);
      const fromIndex = visibleSorted.findIndex((w) => w.id === operation.sourceId);
      if (fromIndex === -1) return result;
      result = dashboardReducer(result, {
        type: "REORDER_WIDGETS",
        fromIndex,
        toIndex: operation.insertionIndex,
      });
      return result;
    }

    case "in-row-insert": {
      let result = state;
      for (const r of operation.resize) {
        result = dashboardReducer(result, {
          type: "RESIZE_WIDGET",
          id: r.id,
          colSpan: r.newSpan,
        });
      }
      const visibleSorted = getVisibleSorted(result.widgets);
      const fromIndex = visibleSorted.findIndex((w) => w.id === operation.sourceId);
      if (fromIndex === -1) return result;
      result = dashboardReducer(result, {
        type: "REORDER_WIDGETS",
        fromIndex,
        toIndex: operation.insertionIndex,
      });
      return result;
    }
```

Add the helper at the bottom of the file:

```ts
function getColSpan(state: DashboardState, id: string): number | undefined {
  return state.widgets.find((w) => w.id === id)?.colSpan;
}
```

- [ ] **Step 4: Run tests.**

```
npx vitest run src/lib/dashboard/engine/__tests__/operation-applier.test.ts src/lib/dashboard/engine/__tests__/operation-applier-lines.test.ts
```

Expected: both files pass.

---

## Task 11: Wire the drag engine

**Files:**
- Modify: `src/lib/dashboard/engine/drag-engine.ts`

The engine has to (a) compute lines per snapshot, (b) pass them into `resolveZone`, (c) commit `new-row` / `in-row-insert` intents on pointer up, (d) emit announcements for new ops.

- [ ] **Step 1: Add the import** for `computeInsertionLines` and the `InsertionLine` type at the top of `drag-engine.ts`:

```ts
import { computeInsertionLines } from "./insertion-lines.ts";
import type { InsertionLine } from "./types.ts";
```

- [ ] **Step 2: Add a private field** for the lines cache. Inside the `DragEngine` class around line 105 (after `private dragLayout: ComputedLayout | null = null;`):

```ts
  private insertionLines: InsertionLine[] = [];
  private currentLineId: string | null = null;
```

- [ ] **Step 3: Track the source id** so `computeInsertionLines` can exclude it. Add a helper method inside the class (after `clearDragState` near line 1745):

```ts
  private recomputeInsertionLines(): void {
    const sourceId =
      this.phase.type === "dragging" ? this.phase.sourceId :
      this.phase.type === "external-dragging" ? null :
      null;

    if (this.phase.type !== "dragging" && this.phase.type !== "external-dragging") {
      this.insertionLines = [];
      this.currentLineId = null;
      return;
    }

    this.insertionLines = computeInsertionLines({
      layout: this.dragLayout ?? this.baseLayout,
      widgets: this.history.present.widgets,
      sourceId,
      dropMode: this.config.dropMode,
      maxColumns: this.history.present.maxColumns,
      containerWidth: this.containerWidth,
      isPositionLocked: this.config.isPositionLocked,
      isResizeLocked: this.config.isResizeLocked,
    });
  }
```

- [ ] **Step 4: Recompute lines on every drag tick.** In `updateZoneAndIntent` (line ~1355), just before the `if (pointerMoved || this.pendingZone !== null)` block (around line 1373), add:

```ts
    this.recomputeInsertionLines();
```

And in `updateExternalZoneAndIntent` (line ~1081), do the same — just before the `if (pointerMoved || ...)` block (around line 1094):

```ts
    this.recomputeInsertionLines();
```

- [ ] **Step 5: Pass lines into `resolveZone`** in `updateZoneAndIntent`. Replace the `resolveZone(...)` call at line ~1381 with:

```ts
      let computedZone = resolveZone(
        zonePointerPos,
        layout,
        state.widgets,
        state.gap,
        state.maxColumns,
        this.containerWidth,
        this.phase.sourceId,
        currentWidgetSide,
        this.config.dropMode,
        this.insertionLines,
        this.config.lineSnapRadius,
        this.currentLineId,
      );
```

Same change at `updateExternalZoneAndIntent` (line ~1102):

```ts
      const computedZone = resolveZone(
        pointerPos,
        layout,
        state.widgets,
        state.gap,
        state.maxColumns,
        this.containerWidth,
        null,
        currentWidgetSide,
        this.config.dropMode,
        this.insertionLines,
        this.config.lineSnapRadius,
        this.currentLineId,
      );
```

- [ ] **Step 6: Track `currentLineId`.** After the zone is finalized in both functions (i.e., in the `this.currentZone = computedZone;` branches), update `currentLineId`:

In `updateZoneAndIntent`, find the two places that do `this.currentZone = computedZone;` and after each, add:

```ts
            this.currentLineId =
              computedZone.type === "insertion-line-h" || computedZone.type === "insertion-line-v"
                ? computedZone.lineId : null;
```

Do the same in `updateExternalZoneAndIntent`.

- [ ] **Step 7: Mark active lines in the snapshot.** Modify `recomputeInsertionLines` so it sets `isActive` on the line matching `currentLineId`. Replace the body with:

```ts
  private recomputeInsertionLines(): void {
    if (this.phase.type !== "dragging" && this.phase.type !== "external-dragging") {
      this.insertionLines = [];
      this.currentLineId = null;
      return;
    }

    const sourceId = this.phase.type === "dragging" ? this.phase.sourceId : null;

    const lines = computeInsertionLines({
      layout: this.dragLayout ?? this.baseLayout,
      widgets: this.history.present.widgets,
      sourceId,
      dropMode: this.config.dropMode,
      maxColumns: this.history.present.maxColumns,
      containerWidth: this.containerWidth,
      isPositionLocked: this.config.isPositionLocked,
      isResizeLocked: this.config.isResizeLocked,
    });

    this.insertionLines = lines.map((l) =>
      l.id === this.currentLineId && !l.disabled ? { ...l, isActive: true } : l,
    );
  }
```

- [ ] **Step 8: Surface `insertionLines` on the snapshot.** Update `getSnapshot()` so `insertionLines` reflects the cached array (replace the placeholder `insertionLines: []` from Task 3 Step 5):

```ts
      insertionLines: this.insertionLines,
```

- [ ] **Step 9: Handle new intents in `commitIntent`.** In `commitIntent` (line ~1649), add two new cases inside the switch (before the closing brace):

```ts
      case "new-row":
        return {
          type: "new-row",
          sourceId,
          insertionIndex: intent.insertionIndex,
          colSpan: intent.colSpan,
        };

      case "in-row-insert":
        return {
          type: "in-row-insert",
          sourceId,
          insertionIndex: intent.insertionIndex,
          resize: intent.resize,
        };
```

- [ ] **Step 10: Add post-commit handling.** In `applyCommittedOperation` (line ~706), add two cases before the final `else`:

```ts
    } else if (committed.type === "new-row" || committed.type === "in-row-insert") {
      const involvedIds = new Set([committed.sourceId]);
      if (committed.type === "in-row-insert") {
        for (const r of committed.resize) involvedIds.add(r.id);
      }
      newState = {
        ...newState,
        widgets: stabilizeUninvolvedWidgets(
          newState.widgets,
          this.baseLayout,
          involvedIds,
          this.containerWidth,
          cfg.maxColumns,
          cfg.gap,
        ),
      };
      newState = {
        ...newState,
        widgets: pinToGreedyColumns(newState.widgets, cfg.maxColumns),
      };
```

This goes right after the `"reorder"` else-if branch — keep the existing `} else {` (terminal `pinToGreedyColumns`) as the catch-all.

- [ ] **Step 11: Add announcement strings.** In `buildDropAnnouncement` (line ~1896), add two cases before `case "cancelled"`:

```ts
      case "new-row":
        return `Inserted as new full-width row at position ${operation.insertionIndex + 1}`;
      case "in-row-insert":
        return operation.resize.length > 0
          ? `Inserted at position ${operation.insertionIndex + 1}, resizing row`
          : `Inserted at position ${operation.insertionIndex + 1}`;
```

- [ ] **Step 12: Update `intentsEqual`.** In `intentsEqual` (line ~1828), add two cases before the closing brace of the switch:

```ts
      case "new-row":
        return (
          a.insertionIndex === (b as typeof a).insertionIndex &&
          a.colSpan === (b as typeof a).colSpan
        );
      case "in-row-insert": {
        const bb = b as typeof a;
        if (a.insertionIndex !== bb.insertionIndex) return false;
        if (a.resize.length !== bb.resize.length) return false;
        for (let i = 0; i < a.resize.length; i++) {
          if (a.resize[i].id !== bb.resize[i].id) return false;
          if (a.resize[i].newSpan !== bb.resize[i].newSpan) return false;
        }
        return true;
      }
```

- [ ] **Step 13: Clear `currentLineId` in `clearDragState`.** Find `clearDragState` (line ~1745) and add:

```ts
    this.currentLineId = null;
    this.insertionLines = [];
```

- [ ] **Step 14: Type-check + run engine tests.**

```
npm run typecheck:lib
npx vitest run src/lib/dashboard/engine
```

Expected: both pass. Some existing tests may need the new `insertionLines: []` field in their snapshot comparisons — if any test breaks because the snapshot now has an extra key, that's the engine producing more data, NOT a regression in production behavior. Inspect the failure to verify it's purely an additive field difference, then move on. (Note: per project rule, do not modify tests — if a strict-equality assertion breaks, re-examine your code to ensure you didn't reshape unrelated fields.)

---

## Task 12: Extend DragConfig (user-facing)

**Files:**
- Modify: `src/lib/dashboard/types/config.ts`

- [ ] **Step 1: Extend `DragConfig`** in `src/lib/dashboard/types/config.ts`. Replace the interface:

```ts
export interface DragConfig {
  activationThreshold?: number;
  touchActivationDelay?: number;
  touchMoveTolerance?: number;
  autoScrollEdgeSize?: number;
  autoScrollMaxSpeed?: number;
  swapDwellMs?: number;
  resizeDwellMs?: number;
  dropAnimationDuration?: number;
  dropMode?: "classic" | "lines" | "both";
  lineSnapRadius?: number;
}
```

- [ ] **Step 2: Type-check.**

```
npm run typecheck:lib
```

Expected: zero errors.

---

## Task 13: Drag-state and provider types updates

**Files:**
- Modify: `src/lib/dashboard/types/drag.ts`
- Modify: `src/lib/dashboard/types/provider.ts`

- [ ] **Step 1: Extend `DragState.intentType` union** in `src/lib/dashboard/types/drag.ts`:

```ts
export interface DragState {
  activeId: string | null;
  dropTargetIndex: number | null;
  previewColSpan: number | null;
  previewLayout: ComputedLayout | null;
  isLongPressing: boolean;
  longPressTargetId: string | null;
  isExternalDrag: boolean;
  externalWidgetType: string | null;
  intentType:
    | "none"
    | "reorder"
    | "swap"
    | "auto-resize"
    | "column-pin"
    | "empty-row-maximize"
    | "new-row"
    | "in-row-insert"
    | null;
}
```

- [ ] **Step 2: Extend `DashboardDragContextValue`** in `src/lib/dashboard/types/provider.ts` to surface lines. Replace the interface:

```ts
import type { InsertionLine } from "../engine/types.ts";

export interface DashboardDragContextValue {
  phase: "idle" | "pending" | "dragging" | "keyboard-dragging" | "dropping" | "external-dragging";
  dragState: DragState;
  insertionLines: InsertionLine[];
}
```

> Note: keep the existing import block intact and add the `InsertionLine` import. Add the field at the end of the interface.

- [ ] **Step 3: Type-check.**

```
npm run typecheck:lib
```

Expected: errors only in `DashboardProvider.tsx` (where `dragValue` no longer satisfies the new context shape) and `build-context-helpers.ts` (no `insertionLines`). Those are fixed in the next tasks.

---

## Task 14: Update build-context-helpers

**Files:**
- Modify: `src/lib/dashboard/react/build-context-helpers.ts`

- [ ] **Step 1: Add `insertionLines` to the returned shape if needed.** `buildDragState` does not need changes (it returns `DragState`, not the context value). `buildEngineConfig` needs `dropMode` + `lineSnapRadius`. Replace `buildEngineConfig` with:

```ts
export function buildEngineConfig(
  maxColumns: number,
  gap: number,
  dragConfig?: DragConfig,
): Partial<DragEngineConfig> {
  return {
    maxColumns,
    gap,
    ...(dragConfig?.activationThreshold != null && { activationThreshold: dragConfig.activationThreshold }),
    ...(dragConfig?.touchActivationDelay != null && { touchActivationDelay: dragConfig.touchActivationDelay }),
    ...(dragConfig?.touchMoveTolerance != null && { touchMoveTolerance: dragConfig.touchMoveTolerance }),
    ...(dragConfig?.swapDwellMs != null && { swapDwellMs: dragConfig.swapDwellMs }),
    ...(dragConfig?.resizeDwellMs != null && { resizeDwellMs: dragConfig.resizeDwellMs }),
    ...(dragConfig?.dropAnimationDuration != null && { dropAnimationDuration: dragConfig.dropAnimationDuration }),
    ...(dragConfig?.dropMode != null && { dropMode: dragConfig.dropMode }),
    ...(dragConfig?.lineSnapRadius != null && { lineSnapRadius: dragConfig.lineSnapRadius }),
  };
}
```

- [ ] **Step 2: Type-check.**

```
npm run typecheck:lib
```

Expected: provider still has one mismatch (context shape).

---

## Task 15: Wire DashboardProvider to surface insertionLines

**Files:**
- Modify: `src/lib/dashboard/react/DashboardProvider.tsx`

- [ ] **Step 1: Update `dragValue`** in `DashboardProvider.tsx` (line ~362) to include `insertionLines`:

```ts
  const dragValue = useMemo(
    () => ({ phase, dragState, insertionLines: snapshot.insertionLines }),
    [phase, dragState, snapshot.insertionLines],
  );
```

- [ ] **Step 2: Type-check.**

```
npm run typecheck:lib
```

Expected: zero errors.

---

## Task 16: useInsertionLines hook

**Files:**
- Create: `src/lib/dashboard/react/use-insertion-lines.ts`

- [ ] **Step 1: Implement** the hook:

```ts
import { useContext } from "react";
import { DashboardDragContext } from "../state/use-dashboard.ts";
import type { InsertionLine } from "../engine/types.ts";

/**
 * Returns the current set of magnetic insertion lines emitted by the drag engine.
 *
 * Lines are only populated when `dropMode` is `'lines'` or `'both'` and a drag is in progress.
 * Each line includes its geometry, an `isActive` flag (true when the pointer is snapped to it),
 * and a `disabled` flag (true for self-adjacent lines, resize-lock conflicts, etc.).
 */
export function useInsertionLines(): InsertionLine[] {
  const ctx = useContext(DashboardDragContext);
  if (!ctx) return [];
  return ctx.insertionLines;
}
```

- [ ] **Step 2: Type-check.**

```
npm run typecheck:lib
```

Expected: zero errors.

---

## Task 17: Public exports

**Files:**
- Modify: `src/lib/dashboard/index.ts`
- Modify: `src/lib/dashboard/engine-entry.ts`

- [ ] **Step 1: Export the hook** from `src/lib/dashboard/index.ts`. Add after the existing hook exports (around line 49):

```ts
export { useInsertionLines } from "./react/use-insertion-lines.ts";
```

- [ ] **Step 2: Export the type** from `src/lib/dashboard/engine-entry.ts`. Update the type export block:

```ts
export type {
  DragEvent as EngineDragEvent,
  DragPhase,
  DropZone,
  OperationIntent,
  CommittedOperation,
  DragEngineConfig,
  DragEngineSnapshot,
  Point,
  InsertionLine,
} from "./engine/types.ts";
```

- [ ] **Step 3: Build the library** to confirm exports resolve.

```
npm run build:lib
```

Expected: success.

---

## Task 18: Demo — InsertionLineElement component

**Files:**
- Create: `src/app/components/InsertionLineElement.tsx`

- [ ] **Step 1: Create the demo component** (NOT in `src/lib/dashboard/`):

```tsx
import { motion } from "motion/react";
import type { InsertionLine } from "../../lib/dashboard/index.ts";

interface InsertionLineElementProps {
  line: InsertionLine;
}

export function InsertionLineElement({ line }: InsertionLineElementProps) {
  const isVertical = line.orientation === "vertical";
  const length = isVertical ? line.y2 - line.y1 : line.x2 - line.x1;
  const thickness = line.isActive ? 4 : 2;
  const baseColor = line.disabled ? "rgba(140,140,140,0.35)" : line.isActive ? "#5b8def" : "rgba(91,141,239,0.5)";

  const style: React.CSSProperties = {
    position: "absolute",
    left: isVertical ? line.x1 - thickness / 2 : line.x1,
    top: isVertical ? line.y1 : line.y1 - thickness / 2,
    width: isVertical ? thickness : length,
    height: isVertical ? length : thickness,
    backgroundColor: baseColor,
    borderRadius: thickness,
    pointerEvents: "none",
    zIndex: 100,
  };

  return (
    <motion.div
      data-testid="insertion-line"
      data-line-id={line.id}
      data-line-orientation={line.orientation}
      data-line-active={line.isActive ? "true" : "false"}
      data-line-disabled={line.disabled ? "true" : "false"}
      data-line-insertion-index={line.insertionIndex}
      initial={{ opacity: 0 }}
      animate={{ opacity: line.disabled ? 0.35 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={style}
    />
  );
}
```

- [ ] **Step 2: Confirm the file type-checks** with the demo build.

```
npm run typecheck:lib
```

(There is no separate demo typecheck — the demo is built via `npm run build`. Run that next to verify.)

---

## Task 19: Demo — render lines + dropMode selector in App

**Files:**
- Modify: `src/app/components/DashboardGrid.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Render lines** inside `DashboardGrid.tsx`. Import the hook and the component at the top:

```ts
import { useInsertionLines } from "../../lib/dashboard/index.ts";
import { InsertionLineElement } from "./InsertionLineElement.tsx";
```

- [ ] **Step 2: Add lines rendering** inside the `<div ref={containerRef} ...>` container, just after the existing `<AnimatePresence>` blocks. Replace the `container` JSX (line ~124 onward) with:

```tsx
  const lines = useInsertionLines();

  const container = (
    <div
      ref={containerRef}
      className={className}
      data-testid="dashboard-grid"
      data-phase={phase}
      data-max-columns={state.maxColumns}
      data-gap={state.gap}
      data-widget-count={visibleWidgets.length}
      style={{
        position: "relative",
        height: containerHeight > 0 ? containerHeight : "auto",
        minHeight: 100,
        ...style,
      }}
    >
      {animated ? (
        <>
          <AnimatePresence>{ghostElement}</AnimatePresence>
          <AnimatePresence mode="popLayout">{widgetElements}</AnimatePresence>
          <AnimatePresence>
            {lines.map((line) => (
              <InsertionLineElement key={line.id} line={line} />
            ))}
          </AnimatePresence>
        </>
      ) : (
        <>
          {ghostElement}
          {widgetElements}
          {lines.map((line) => (
            <InsertionLineElement key={line.id} line={line} />
          ))}
        </>
      )}
    </div>
  );
```

The `const lines = useInsertionLines();` declaration needs to appear before `const container = ...`. The hook must be called unconditionally (React rule of hooks), so put it just after the `useEffect` near line 47.

- [ ] **Step 3: Add a dropMode selector to App.tsx.** Find the existing controls in `src/app/App.tsx` (the header area where the column selector lives — search for "1 col" / "2 cols" buttons or similar). Add a small selector. First, add state at the top of `App.tsx` near line 40:

```ts
const [dropMode, setDropMode] = useState<"classic" | "lines" | "both">("classic");
```

- [ ] **Step 4: Pass `dropMode` to the provider.** In `App.tsx`, find the `<DashboardProvider … dragConfig={DRAG_CONFIG} … />` usage. Replace `dragConfig={DRAG_CONFIG}` with:

```tsx
dragConfig={{ ...DRAG_CONFIG, dropMode }}
```

- [ ] **Step 5: Add the selector UI.** Inside the `DashboardContent` body, locate the existing column selector buttons (`.dash-header` div containing "1 col" / "2 cols" / "3 cols" buttons — `grep -n '"1 col"' src/app/App.tsx`). Add a sibling div in the same parent container, just after the column selector:

```tsx
<div className="dash-header__group" data-testid="drop-mode-selector">
  {(["classic", "lines", "both"] as const).map((m) => (
    <button
      key={m}
      type="button"
      data-drop-mode={m}
      data-active={m === dropMode ? "true" : "false"}
      onClick={() => onDropModeChange?.(m)}
    >
      {m}
    </button>
  ))}
</div>
```

> Note: `onDropModeChange` is the new callback prop passed from the parent. Plumb it through `DashboardContentProps` and pass `setDropMode` from the outer `App` component. If the existing controls don't use a parent-to-child callback pattern, just lift `dropMode` state up to the outer component and pass it directly.

- [ ] **Step 6: Run the dev server** in another shell and confirm visually.

```
npm run dev -- --port 4174
```

Open http://localhost:4174, click the `lines` button, and drag a widget. Lines should appear during drag. The active line should highlight when the pointer is within ~16px.

> If you cannot run the dev server interactively, skip to Task 20 — Playwright tests will verify behaviour automatically.

---

## Task 20: E2E — insertion-lines-render

**Files:**
- Create: `e2e/insertion-lines-render.spec.ts`

- [ ] **Step 1: Write the spec.**

```ts
import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById } from "./helpers/locators";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — rendering", () => {
  test("no lines visible when idle", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await setDropMode(page, "lines");
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBe(0);
  });

  test("no lines visible in classic mode during drag", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "classic");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.waitForTimeout(100);
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBe(0);
    await page.mouse.up();
  });

  test("lines appear during drag in lines mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
    await page.waitForTimeout(150);
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test("lines disappear after drop", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const lines = await page.locator('[data-testid="insertion-line"]').count();
    expect(lines).toBe(0);
  });

  test("emits 3 horizontal lines for a single-row layout (above + 1 below + 1 outer-right? no, for 1 row: above + below = 2 H-lines; for 2 rows: above + between + below = 3)", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"]);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30);
    await page.waitForTimeout(150);
    const hLines = await page.locator('[data-testid="insertion-line"][data-line-orientation="horizontal"]').count();
    expect(hLines).toBe(3);
    await page.mouse.up();
  });
});
```

- [ ] **Step 2: Run the spec.**

```
npm run dev -- --port 4174 &
sleep 3
npx playwright test e2e/insertion-lines-render.spec.ts
```

Expected: all 5 tests pass.

(Use `npm run test:e2e` for the full suite once you're done.)

---

## Task 21: E2E — insertion-lines-magnetic

**Files:**
- Create: `e2e/insertion-lines-magnetic.spec.ts`

- [ ] **Step 1: Write the spec.**

```ts
import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — magnetic snap", () => {
  test("active flag flips on when pointer enters snap radius", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await setDropMode(page, "lines");

    const handle = widgetDragHandleById(page, "a");
    const handleBox = await handle.boundingBox();
    const widgetB = await widgetById(page, "b").boundingBox();
    if (!handleBox || !widgetB) throw new Error("box");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    const targetX = widgetB.x + widgetB.width;
    const targetY = widgetB.y + widgetB.height / 2;
    await page.mouse.move(targetX + 30, targetY);
    await page.waitForTimeout(150);

    let activeCount = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(activeCount).toBe(0);

    await page.mouse.move(targetX + 4, targetY);
    await page.waitForTimeout(150);

    activeCount = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(activeCount).toBe(1);

    await page.mouse.up();
  });

  test("hysteresis keeps line active when pointer moves slightly past snap radius", async ({ page }) => {
    await setupDashboard(page, ["A B"]);
    await setDropMode(page, "lines");

    const handle = widgetDragHandleById(page, "a");
    const handleBox = await handle.boundingBox();
    const widgetB = await widgetById(page, "b").boundingBox();
    if (!handleBox || !widgetB) throw new Error("box");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    const targetX = widgetB.x + widgetB.width;
    const targetY = widgetB.y + widgetB.height / 2;

    await page.mouse.move(targetX + 4, targetY);
    await page.waitForTimeout(150);

    await page.mouse.move(targetX + 20, targetY);
    await page.waitForTimeout(150);
    const activeCount = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(activeCount).toBe(1);

    await page.mouse.move(targetX + 30, targetY);
    await page.waitForTimeout(150);
    const noneActive = await page.locator('[data-testid="insertion-line"][data-line-active="true"]').count();
    expect(noneActive).toBe(0);

    await page.mouse.up();
  });
});
```

- [ ] **Step 2: Run.**

```
npx playwright test e2e/insertion-lines-magnetic.spec.ts
```

Expected: pass.

---

## Task 22: E2E — insertion-lines-h-drop

**Files:**
- Create: `e2e/insertion-lines-h-drop.spec.ts`

- [ ] **Step 1: Write the spec.**

```ts
import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function dropOnHLine(page: import("@playwright/test").Page, sourceId: string, x: number, y: number) {
  const handle = widgetDragHandleById(page, sourceId);
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.describe("Insertion lines — horizontal drop creates new full-width row", () => {
  test("drop on bottom H-line places source as full-width new last row", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const widgetD = await widgetById(page, "d").boundingBox();
    if (!widgetD) throw new Error("d box");

    await dropOnHLine(page, "a", widgetD.x + widgetD.width / 2, widgetD.y + widgetD.height + 8);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![grid!.length - 1]).toEqual(["a", "a"]);
  });

  test("drop on top H-line places source as full-width new first row", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const widgetA = await widgetById(page, "a").boundingBox();
    if (!widgetA) throw new Error("a box");

    await dropOnHLine(page, "c", widgetA.x + widgetA.width / 2, widgetA.y - 8);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![0]).toEqual(["c", "c"]);
  });

  test("drop on between-row H-line places source between rows full-width", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const widgetB = await widgetById(page, "b").boundingBox();
    const widgetD = await widgetById(page, "d").boundingBox();
    if (!widgetB || !widgetD) throw new Error("box");

    const y = (widgetB.y + widgetB.height + widgetD.y) / 2;
    await dropOnHLine(page, "a", widgetB.x + widgetB.width / 2, y);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid!.find((row) => row[0] === "a" && row[1] === "a")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run.**

```
npx playwright test e2e/insertion-lines-h-drop.spec.ts
```

Expected: pass.

---

## Task 23: E2E — insertion-lines-v-drop

**Files:**
- Create: `e2e/insertion-lines-v-drop.spec.ts`

- [ ] **Step 1: Write the spec.**

```ts
import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

async function dropOnVLine(page: import("@playwright/test").Page, sourceId: string, x: number, y: number) {
  const handle = widgetDragHandleById(page, sourceId);
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.describe("Insertion lines — vertical drop in-row insertion", () => {
  test("V-line drop without resize when row has space", async ({ page }) => {
    // Setup: row 1 = A (colSpan 1, pinned col 0), row 2 = B (colSpan 1, pinned col 0). maxColumns=3.
    // Drop B at outer-right of A. Row total 1+1=2 ≤ 3, no resize. B goes to col 1 of row 0.
    await setupDashboard(page, ["A", "B"], 3);
    await setDropMode(page, "lines");

    const widgetA = await widgetById(page, "a").boundingBox();
    if (!widgetA) throw new Error("a");
    const x = widgetA.x + widgetA.width;
    const y = widgetA.y + widgetA.height / 2;

    await dropOnVLine(page, "b", x, y);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![0][0]).toBe("a");
    expect(grid![0][1]).toBe("b");
  });

  test("V-line drop with equal-distribute resize when row overflows", async ({ page }) => {
    // Setup: row 1 = A (colSpan 2), row 2 = B (colSpan 2). maxColumns=3.
    // Drop B at outer-right of A. Row total would be 2+2=4 > 3.
    // equalDistribute n=2, base=1, rem=1 → A stays 2 (left), B shrinks to 1.
    // Result row: a a b
    await setupDashboard(page, ["A A", "B B"], 3);
    await setDropMode(page, "lines");

    const widgetA = await widgetById(page, "a").boundingBox();
    if (!widgetA) throw new Error("a");
    const x = widgetA.x + widgetA.width;
    const y = widgetA.y + widgetA.height / 2;

    await dropOnVLine(page, "b", x, y);

    const grid = await getGridRepresentation(page);
    expect(grid).not.toBeNull();
    expect(grid![0]).toEqual(["a", "a", "b"]);
  });
});
```

- [ ] **Step 2: Run.**

```
npx playwright test e2e/insertion-lines-v-drop.spec.ts
```

Expected: pass. If the equal-distribute case shows a different row layout, examine the grid representation and decide if the assertion needs to be more relaxed (e.g., asserting on widget order rather than exact span — but DO NOT change the spec; instead, verify the underlying engine behavior in unit tests and confirm the algorithm is correct per spec §6.4).

---

## Task 24: E2E — insertion-lines-edge-cases

**Files:**
- Create: `e2e/insertion-lines-edge-cases.spec.ts`

- [ ] **Step 1: Write the spec.**

```ts
import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — edge cases", () => {
  test("1-column mode emits only horizontal lines", async ({ page }) => {
    await setupDashboard(page, ["A", "B", "C"], 1);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 50);
    await page.waitForTimeout(150);
    const vLines = await page.locator('[data-testid="insertion-line"][data-line-orientation="vertical"]').count();
    expect(vLines).toBe(0);
    const hLines = await page.locator('[data-testid="insertion-line"][data-line-orientation="horizontal"]').count();
    expect(hLines).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test("self-adjacent line is rendered as disabled", async ({ page }) => {
    await setupDashboard(page, ["A B"], 2);
    await setDropMode(page, "lines");
    const handle = widgetDragHandleById(page, "a");
    const box = await handle.boundingBox();
    if (!box) throw new Error("box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5);
    await page.waitForTimeout(150);
    const disabledLines = await page.locator('[data-testid="insertion-line"][data-line-disabled="true"]').count();
    expect(disabledLines).toBeGreaterThan(0);
    await page.mouse.up();
  });
});
```

- [ ] **Step 2: Run.**

```
npx playwright test e2e/insertion-lines-edge-cases.spec.ts
```

Expected: pass.

---

## Task 25: E2E — insertion-lines-modes

**Files:**
- Create: `e2e/insertion-lines-modes.spec.ts`

- [ ] **Step 1: Write the spec.**

```ts
import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { widgetDragHandleById, widgetById } from "./helpers/locators";
import { getGridRepresentation } from "./helpers/layout-utils";

async function setDropMode(page: import("@playwright/test").Page, mode: "classic" | "lines" | "both") {
  await page.locator(`[data-testid="drop-mode-selector"] [data-drop-mode="${mode}"]`).click();
}

test.describe("Insertion lines — mode arbitration", () => {
  test("swap on widget center works in classic mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "classic");

    const aBox = await widgetById(page, "a").boundingBox();
    const dBox = await widgetById(page, "d").boundingBox();
    if (!aBox || !dBox) throw new Error("box");

    const handle = widgetDragHandleById(page, "a");
    const hBox = await handle.boundingBox();
    if (!hBox) throw new Error("handle box");

    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dBox.x + dBox.width / 2, dBox.y + dBox.height / 2);
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).toEqual([["d", "b"], ["c", "a"]]);
  });

  test("swap on widget center works in lines mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const dBox = await widgetById(page, "d").boundingBox();
    if (!dBox) throw new Error("box");

    const handle = widgetDragHandleById(page, "a");
    const hBox = await handle.boundingBox();
    if (!hBox) throw new Error("handle box");

    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dBox.x + dBox.width / 2, dBox.y + dBox.height / 2);
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).toEqual([["d", "b"], ["c", "a"]]);
  });

  test("dead-space drop cancels in lines mode", async ({ page }) => {
    await setupDashboard(page, ["A B", "C D"], 2);
    await setDropMode(page, "lines");

    const aBox = await widgetById(page, "a").boundingBox();
    if (!aBox) throw new Error("box");

    const handle = widgetDragHandleById(page, "a");
    const hBox = await handle.boundingBox();
    if (!hBox) throw new Error("handle box");

    await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(aBox.x - 200, aBox.y - 200);
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const grid = await getGridRepresentation(page);
    expect(grid).toEqual([["a", "b"], ["c", "d"]]);
  });
});
```

- [ ] **Step 2: Run.**

```
npx playwright test e2e/insertion-lines-modes.spec.ts
```

Expected: pass.

---

## Task 26: Update README + CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `changelog.md`

- [ ] **Step 1: Add a section to `README.md`.** Insert after the existing drag-behaviors section (search for "## Drag Behaviors" or similar; if absent, add near the bottom under "## Features"):

````markdown
## Insertion lines (opt-in)

The dashboard supports a magnetic insertion-line drop UI as an alternative to dwell-based drag operations.

```tsx
<DashboardProvider
  definitions={defs}
  initialWidgets={widgets}
  dragConfig={{ dropMode: "lines", lineSnapRadius: 16 }}
>
  …
</DashboardProvider>
```

Modes:
- `'classic'` (default) — original gap-reorder, swap-on-dwell, side-drop semantics. Backward-compatible.
- `'lines'` — magnetic insertion lines determine drops. Swap on widget center still works. Drops outside lines cancel.
- `'both'` — lines win inside the magnetic snap radius; classic resolver runs elsewhere.

Use `useInsertionLines()` in your grid component to render the lines:

```tsx
import { useInsertionLines } from "editable-dashboard";

function Lines() {
  const lines = useInsertionLines();
  return (
    <>
      {lines.map(line => <YourLineComponent key={line.id} line={line} />)}
    </>
  );
}
```

Each line carries:
- `orientation` (`'horizontal' | 'vertical'`)
- `x1, y1, x2, y2` (geometry)
- `isActive` (pointer snapped to it)
- `disabled` (self-adjacent or resize-lock conflict)

Vertical line drops trigger an equal-distribute resize if the row would overflow `maxColumns`. Horizontal line drops insert the source as a new full-width row.
````

- [ ] **Step 2: Add an entry to `changelog.md`.** Add under the most recent unreleased section (or create a new section at the top):

```markdown
### Added

- New `dropMode` config (`'classic' | 'lines' | 'both'`, default `'classic'`) and `lineSnapRadius` (default `16`) on `DragConfig`.
- New `InsertionLine` engine type and `insertionLines: InsertionLine[]` field on `DragEngineSnapshot`.
- New `useInsertionLines()` React hook for consumer-rendered drop indicators.
- New `OperationIntent` / `CommittedOperation` variants: `new-row` (drop on H-line) and `in-row-insert` (drop on V-line with equal-distribute resize fallback).
- E2E coverage: `insertion-lines-render`, `insertion-lines-magnetic`, `insertion-lines-h-drop`, `insertion-lines-v-drop`, `insertion-lines-edge-cases`, `insertion-lines-modes`.
- Unit coverage: `equal-distribute`, `insertion-lines` (`computeInsertionLines`, `findSnappedLine`), `zone-resolver-lines`, `intent-resolver-lines`, `operation-applier-lines`, `zones-equal-lines`.
```

- [ ] **Step 3: Confirm no other docs need updating.** Search for `dropMode` and `InsertionLine` across the repo:

```
grep -r "dropMode" docs/ src/ README.md 2>/dev/null
```

Expected: references only inside the new spec/plan files plus the code you added.

---

## Final verification

- [ ] **Step 1: Lint.**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 2: Type-check the library.**

```
npm run typecheck:lib
```

Expected: zero errors.

- [ ] **Step 3: Run full unit suite.**

```
npm run test
```

Expected: all tests pass — both the new line-related tests and every pre-existing test.

- [ ] **Step 4: Build the library.**

```
npm run build:lib
```

Expected: success. Output in `dist/`.

- [ ] **Step 5: Run full e2e suite.** Start the dev server in another shell first:

```
npm run dev -- --port 4174 &
sleep 3
npm run test:e2e
```

Expected: all suites pass, including the six new `insertion-lines-*.spec.ts` files.

- [ ] **Step 6: Stop the dev server.**

```
pkill -f "vite.*4174"
```

When all six verification steps succeed, the plan is complete. Do **not** create a git commit — the user commits when ready.
