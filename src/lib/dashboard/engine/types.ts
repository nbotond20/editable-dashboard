import type { ComputedLayout, WidgetState } from "../types.ts";

// ─── Geometry ────────────────────────────────────────────────

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ─── Events ──────────────────────────────────────────────────

export type PointerType = "mouse" | "touch" | "pen";

export type DragEvent =
  | {
      type: "POINTER_DOWN";
      id: string;
      position: Point;
      timestamp: number;
      pointerType: PointerType;
    }
  | { type: "POINTER_MOVE"; position: Point; timestamp: number }
  | { type: "POINTER_UP"; timestamp: number }
  | { type: "POINTER_CANCEL"; timestamp: number }
  | { type: "KEY_PICKUP"; id: string; timestamp: number }
  | { type: "KEY_MOVE"; direction: "up" | "down"; timestamp: number }
  | { type: "KEY_RESIZE"; direction: "shrink" | "grow"; timestamp: number }
  | { type: "KEY_DROP"; timestamp: number }
  | { type: "KEY_CANCEL"; timestamp: number }
  | { type: "CANCEL"; timestamp: number }
  | { type: "TICK"; timestamp: number }
  | { type: "RESIZE_TOGGLE"; id: string; timestamp: number }
  | { type: "SET_HEIGHTS"; heights: ReadonlyMap<string, number> }
  | { type: "SET_CONTAINER"; width: number };

// ─── FSM Phases ──────────────────────────────────────────────

export type DragPhase =
  | { type: "idle" }
  | {
      type: "pending";
      sourceId: string;
      startPos: Point;
      startTime: number;
      pointerType: PointerType;
      cumulativeDistance: number;
    }
  | {
      type: "dragging";
      sourceId: string;
      pointerPos: Point;
      grabOffset: Point;
    }
  | {
      type: "keyboard-dragging";
      sourceId: string;
      currentIndex: number;
      originalIndex: number;
      currentColSpan: number;
      originalColSpan: number;
    }
  | {
      type: "dropping";
      sourceId: string;
      operation: CommittedOperation;
      startTime: number;
    };

// ─── Drop Zones ──────────────────────────────────────────────

export type DropZone =
  | {
      type: "gap";
      beforeId: string | null;
      afterId: string | null;
      index: number;
    }
  | { type: "widget"; targetId: string }
  | { type: "empty"; column: number }
  | { type: "outside" };

// ─── Operation Intents (what WOULD happen on drop) ───────────

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
  | { type: "column-pin"; column: number };

// ─── Committed Operations (what DOES happen) ─────────────────

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
  | { type: "resize-toggle"; id: string; newSpan: number }
  | { type: "cancelled" };

// ─── Configuration ───────────────────────────────────────────

export interface DragEngineConfig {
  // Activation
  activationThreshold: number;
  touchActivationDelay: number;
  touchMoveTolerance: number;

  // Dwell timing
  swapDwellMs: number;
  resizeDwellMs: number;

  // Layout behavior
  autoFillMode: "immediate" | "on-drop" | "none";
  maxColumns: number;
  gap: number;

  // Drop animation
  dropAnimationDuration: number;

  // Constraints
  isLocked: (id: string) => boolean;
  canDrop: (sourceId: string, targetIndex: number) => boolean;
  getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number };
}

// ─── Engine Snapshot ─────────────────────────────────────────

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
}

// ─── Layout Options ──────────────────────────────────────────

export interface LayoutOptions {
  phantom?: {
    id: string;
    colSpan: number;
    height: number;
    order: number;
  };
  excludeIds?: ReadonlySet<string>;
}

// ─── Helpers ─────────────────────────────────────────────────

export function getVisibleSorted(widgets: readonly WidgetState[]): WidgetState[] {
  return widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);
}

export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
  }
}
