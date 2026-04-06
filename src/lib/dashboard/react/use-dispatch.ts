import { useCallback } from "react";
import type {
  DashboardAction,
  DashboardState,
} from "../types.ts";
import type { DragEngine } from "../engine/drag-engine.ts";

/**
 * Creates a stable `dispatch` function that delegates to the engine.
 *
 * In both controlled and uncontrolled modes, the engine now owns state
 * mutations and fires `onCommit` to notify the React layer. This hook
 * simply wraps `engine.dispatch` and fires per-action mutation callbacks.
 */
export function useDispatch(
  engine: DragEngine,
  fireMutationCallbacks: (
    action: DashboardAction,
    prevState: DashboardState,
    nextState: DashboardState,
  ) => void,
) {
  const dispatch = useCallback(
    (action: DashboardAction) => {
      const prevState = engine.getState();
      engine.dispatch(action);
      const nextState = engine.getState();
      fireMutationCallbacks(action, prevState, nextState);
    },
    [engine, fireMutationCallbacks],
  );

  return dispatch;
}
