import type { ComputedLayout, DashboardAction, DashboardState, WidgetState } from "../types.ts";

export interface Point {
  readonly x: number;
  readonly y: number;
}

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

export type DropZone =
  | {
      type: "gap";
      beforeId: string | null;
      afterId: string | null;
      index: number;
    }
  | { type: "widget"; targetId: string; side: "left" | "right" }
  | { type: "empty"; column: number }
  | { type: "outside" };

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
  | { type: "column-pin"; column: number; pointerY?: number };

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

/**
 * Describes what caused a state commit inside the engine.
 */
export type CommitSource =
  | { type: "action"; action: DashboardAction }
  | { type: "drag-operation"; operation: CommittedOperation }
  | { type: "undo" }
  | { type: "redo" };

export interface DragEngineConfig {
  activationThreshold: number;
  touchActivationDelay: number;
  touchMoveTolerance: number;
  swapDwellMs: number;
  resizeDwellMs: number;
  autoFillMode: "immediate" | "on-drop" | "none";
  maxColumns: number;
  gap: number;
  dropAnimationDuration: number;
  maxUndoDepth: number;
  isPositionLocked: (id: string) => boolean;
  isResizeLocked: (id: string) => boolean;
  canDrop: (sourceId: string, targetIndex: number) => boolean;
  getWidgetConstraints: (id: string) => { minSpan: number; maxSpan: number };
  onCommit?: (nextState: DashboardState, prevState: DashboardState, source: CommitSource) => void;
}

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

export interface LayoutOptions {
  phantom?: {
    id: string;
    colSpan: number;
    height: number;
    order: number;
    columnStart?: number;
  };
  excludeIds?: ReadonlySet<string>;
}

export { getVisibleSorted, distance, zonesEqual } from "./utils.ts";
