import { useCallback, useMemo } from "react";
import type {
  DashboardActions,
  DashboardError,
  DashboardState,
  WidgetDefinition,
  LockType,
} from "../types.ts";
import { isLockActive } from "../locks.ts";
import { createDashboardError } from "../validation.ts";

export interface UseActionsOptions {
  dispatch: React.Dispatch<import("../types.ts").DashboardAction>;
  definitions: WidgetDefinition[];
  getState: () => DashboardState;
  maxWidgets?: number;
  onError?: (error: DashboardError) => void;
}

export function useActions(opts: UseActionsOptions): DashboardActions {
  const { dispatch, definitions, getState, maxWidgets, onError } = opts;

  const addWidget = useCallback(
    (widgetType: string, colSpan?: number, config?: Record<string, unknown>) => {
      const def = definitions.find((d) => d.type === widgetType);

      if (!def) {
        onError?.(
          createDashboardError(
            "INVALID_WIDGET_TYPE",
            `Cannot add widget: unknown type "${widgetType}"`,
            { widgetType },
          ),
        );
        return;
      }

      if (maxWidgets != null && getState().widgets.length >= maxWidgets) {
        onError?.(
          createDashboardError(
            "MAX_WIDGETS_REACHED",
            `Cannot add widget: maximum of ${maxWidgets} widgets reached`,
            { maxWidgets, currentCount: getState().widgets.length },
          ),
        );
        return;
      }

      const span = colSpan ?? def.defaultColSpan ?? 1;
      dispatch({ type: "ADD_WIDGET", widgetType, colSpan: span, config });
    },
    [dispatch, definitions, getState, maxWidgets, onError]
  );

  const removeWidget = useCallback(
    (id: string) => {
      if (isLockActive(id, "remove", getState(), definitions)) return;
      dispatch({ type: "REMOVE_WIDGET", id });
    },
    [dispatch, definitions, getState]
  );

  const resizeWidget = useCallback(
    (id: string, colSpan: number) => {
      if (isLockActive(id, "resize", getState(), definitions)) return;

      const state = getState();
      const widget = state.widgets.find((w) => w.id === id);
      const def = widget ? definitions.find((d) => d.type === widget.type) : undefined;

      const minSpan = def?.minColSpan ?? 1;
      const maxSpan = Math.min(def?.maxColSpan ?? state.maxColumns, state.maxColumns);
      const clamped = Math.max(minSpan, Math.min(colSpan, maxSpan));

      if (clamped !== colSpan) {
        onError?.(
          createDashboardError(
            "INVALID_COL_SPAN",
            `colSpan ${colSpan} clamped to ${clamped} for widget "${id}"`,
            { widgetId: id, requested: colSpan, clamped, minSpan, maxSpan },
          ),
        );
      }

      dispatch({ type: "RESIZE_WIDGET", id, colSpan: clamped });
    },
    [dispatch, definitions, getState, onError]
  );

  const reorderWidgets = useCallback(
    (fromIndex: number, toIndex: number) => {
      const state = getState();
      const visible = [...state.widgets]
        .filter((w) => w.visible)
        .sort((a, b) => a.order - b.order);

      if (fromIndex < 0 || fromIndex >= visible.length || toIndex < 0 || toIndex >= visible.length) {
        onError?.(
          createDashboardError(
            "INVALID_REORDER_INDEX",
            `Reorder indices out of bounds: fromIndex=${fromIndex}, toIndex=${toIndex}, visibleCount=${visible.length}`,
            { fromIndex, toIndex, visibleCount: visible.length },
          ),
        );
        return;
      }

      if (fromIndex === toIndex) return;

      const source = visible[fromIndex];
      const target = visible[toIndex];
      if (source && isLockActive(source.id, "position", state, definitions)) return;
      if (target && isLockActive(target.id, "position", state, definitions)) return;
      dispatch({ type: "REORDER_WIDGETS", fromIndex, toIndex });
    },
    [dispatch, definitions, getState, onError]
  );

  const setMaxColumns = useCallback(
    (maxColumns: number) => dispatch({ type: "SET_MAX_COLUMNS", maxColumns }),
    [dispatch]
  );

  const batchUpdate = useCallback(
    (widgets: import("../types.ts").WidgetState[]) =>
      dispatch({ type: "BATCH_UPDATE", widgets }),
    [dispatch]
  );

  const updateWidgetConfig = useCallback(
    (id: string, config: Record<string, unknown>) =>
      dispatch({ type: "UPDATE_WIDGET_CONFIG", id, config }),
    [dispatch]
  );

  const showWidget = useCallback(
    (id: string) => dispatch({ type: "SHOW_WIDGET", id }),
    [dispatch]
  );

  const hideWidget = useCallback(
    (id: string) => dispatch({ type: "HIDE_WIDGET", id }),
    [dispatch]
  );

  const setWidgetLock = useCallback(
    (id: string, lockType: LockType, locked: boolean) =>
      dispatch({ type: "SET_WIDGET_LOCK", id, lockType, locked }),
    [dispatch]
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), [dispatch]);

  const redo = useCallback(() => dispatch({ type: "REDO" }), [dispatch]);

  return useMemo(
    () => ({
      addWidget,
      removeWidget,
      resizeWidget,
      reorderWidgets,
      setMaxColumns,
      batchUpdate,
      updateWidgetConfig,
      showWidget,
      hideWidget,
      setWidgetLock,
      undo,
      redo,
    }),
    [addWidget, removeWidget, resizeWidget, reorderWidgets, setMaxColumns, batchUpdate, updateWidgetConfig, showWidget, hideWidget, setWidgetLock, undo, redo]
  );
}
