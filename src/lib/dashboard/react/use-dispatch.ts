import { useCallback, useRef, useEffect } from "react";
import type {
  DashboardAction,
  DashboardState,
  DashboardStateInput,
} from "../types.ts";
import { dashboardReducer } from "../state/dashboard-reducer.ts";
import type { DragEngine } from "../engine/drag-engine.ts";

/**
 * Creates a stable `dispatch` function that bridges controlled and
 * uncontrolled modes.
 *
 * - **Uncontrolled:** delegates to `engine.dispatch`, then reads the new state.
 * - **Controlled:** runs the action through `dashboardReducer` locally and
 *   calls `onStateChange` with the result (the engine is *not* mutated).
 *
 * In both modes `fireMutationCallbacks` is invoked with the previous and next
 * state so that per-action callbacks (`onWidgetAdd`, etc.) fire correctly.
 */
export function useDispatch(
  engine: DragEngine,
  onStateChange: ((s: DashboardStateInput) => void) | undefined,
  fireMutationCallbacks: (
    action: DashboardAction,
    prevState: DashboardState,
    nextState: DashboardState,
  ) => void,
) {
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; });

  const dispatch = useCallback(
    (action: DashboardAction) => {
      const prevState = engine.getState();

      if (onStateChangeRef.current) {
        const nextState = dashboardReducer(prevState, action);
        onStateChangeRef.current({
          widgets: nextState.widgets,
          maxColumns: nextState.maxColumns,
          gap: nextState.gap,
        });
        fireMutationCallbacks(action, prevState, nextState);
      } else {
        engine.dispatch(action);
        const nextState = engine.getState();
        fireMutationCallbacks(action, prevState, nextState);
      }
    },
    [engine, fireMutationCallbacks],
  );

  return dispatch;
}
