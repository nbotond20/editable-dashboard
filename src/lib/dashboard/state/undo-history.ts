export interface UndoHistory<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createUndoHistory<T>(initial: T): UndoHistory<T> {
  return { past: [], present: initial, future: [] };
}

export function pushState<T>(
  history: UndoHistory<T>,
  state: T,
  maxDepth: number
): UndoHistory<T> {
  const past = [...history.past, history.present];
  return {
    past: past.length > maxDepth ? past.slice(past.length - maxDepth) : past,
    present: state,
    future: [],
  };
}

export function undo<T>(history: UndoHistory<T>): UndoHistory<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: UndoHistory<T>): UndoHistory<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function canUndo<T>(history: UndoHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: UndoHistory<T>): boolean {
  return history.future.length > 0;
}
