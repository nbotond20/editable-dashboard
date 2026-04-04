export * from "./index.ts";

export { DragEngine } from "./engine/drag-engine.ts";
export type {
  DragEvent as EngineDragEvent,
  DragPhase,
  DropZone,
  OperationIntent,
  CommittedOperation,
  DragEngineConfig,
  DragEngineSnapshot,
  Point,
} from "./engine/types.ts";

export { useAutoScroll } from "./drag/use-auto-scroll.ts";
export { useDragAnnouncements } from "./drag/use-drag-announcements.ts";

export type { UndoHistory } from "./state/undo-history.ts";
export {
  createUndoHistory,
  pushState,
  undo,
  redo,
  canUndo,
  canRedo,
} from "./state/undo-history.ts";

export {
  TOUCH_DRAG_ACTIVATION_DELAY,
  TOUCH_MOVE_TOLERANCE,
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
} from "./constants.ts";
