import { useReducer, useCallback, useMemo } from "react";
import type { DashboardAction, DashboardState } from "../types.ts";
import { dashboardReducer } from "./dashboard-reducer.ts";
import {
  type UndoHistory,
  createUndoHistory,
  pushState,
  undo,
  redo,
  canUndo as checkCanUndo,
  canRedo as checkCanRedo,
} from "./undo-history.ts";

const DEFAULT_MAX_UNDO_DEPTH = 50;

const UNDOABLE_ACTIONS: ReadonlySet<DashboardAction["type"]> = new Set([
  "ADD_WIDGET",
  "REMOVE_WIDGET",
  "REORDER_WIDGETS",
  "RESIZE_WIDGET",
  "BATCH_UPDATE",
  "SET_MAX_COLUMNS",
]);

interface UndoReducerState {
  history: UndoHistory<DashboardState>;
}

function createUndoReducer(maxDepth: number) {
  return function undoReducer(
    state: UndoReducerState,
    action: DashboardAction
  ): UndoReducerState {
    switch (action.type) {
      case "UNDO": {
        const next = undo(state.history);
        return next === state.history ? state : { history: next };
      }

      case "REDO": {
        const next = redo(state.history);
        return next === state.history ? state : { history: next };
      }

      default: {
        const newPresent = dashboardReducer(state.history.present, action);

        if (newPresent === state.history.present) return state;

        if (UNDOABLE_ACTIONS.has(action.type)) {
          return {
            history: pushState(state.history, newPresent, maxDepth),
          };
        }

        return {
          history: { ...state.history, present: newPresent },
        };
      }
    }
  };
}

export function useUndoReducer(
  initialState: DashboardState,
  maxDepth: number = DEFAULT_MAX_UNDO_DEPTH
) {
  const reducer = useMemo(() => createUndoReducer(maxDepth), [maxDepth]);

  const [{ history }, rawDispatch] = useReducer(reducer, {
    history: createUndoHistory(initialState),
  });

  const dispatch = useCallback(
    (action: DashboardAction) => rawDispatch(action),
    []
  );

  return useMemo(
    () => ({
      state: history.present,
      dispatch,
      canUndo: checkCanUndo(history),
      canRedo: checkCanRedo(history),
    }),
    [history, dispatch]
  );
}
