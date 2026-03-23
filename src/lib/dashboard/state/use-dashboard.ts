import { createContext, useContext, useCallback, useMemo } from "react";
import type {
  DashboardContextValue,
  DashboardActions,
  DashboardState,
  WidgetDefinition,
} from "../types.ts";

export const DashboardContext = createContext<DashboardContextValue | null>(
  null
);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

/** Resolve whether a widget is locked by checking runtime state then definition. */
function isLocked(
  id: string,
  state: DashboardState,
  definitions: WidgetDefinition[]
): boolean {
  const widget = state.widgets.find((w) => w.id === id);
  if (widget?.locked != null) return widget.locked;
  if (!widget) return false;
  const def = definitions.find((d) => d.type === widget.type);
  return def?.locked === true;
}

/** Look up a definition-level constraint for a widget. */
function getDefConstraint(
  id: string,
  field: "removable" | "hideable" | "resizable",
  state: DashboardState,
  definitions: WidgetDefinition[]
): boolean {
  const widget = state.widgets.find((w) => w.id === id);
  if (!widget) return true;
  const def = definitions.find((d) => d.type === widget.type);
  return def?.[field] !== false;
}

export interface UseActionsOptions {
  dispatch: React.Dispatch<import("../types.ts").DashboardAction>;
  definitions: WidgetDefinition[];
  getState: () => DashboardState;
  maxWidgets?: number;
}

export function useActions(opts: UseActionsOptions): DashboardActions {
  const { dispatch, definitions, getState, maxWidgets } = opts;

  const addWidget = useCallback(
    (widgetType: string, colSpan?: number, config?: Record<string, unknown>) => {
      if (maxWidgets != null && getState().widgets.length >= maxWidgets) return;
      const def = definitions.find((d) => d.type === widgetType);
      const span = colSpan ?? def?.defaultColSpan ?? 1;
      dispatch({ type: "ADD_WIDGET", widgetType, colSpan: span, config });
    },
    [dispatch, definitions, getState, maxWidgets]
  );

  const removeWidget = useCallback(
    (id: string) => {
      if (!getDefConstraint(id, "removable", getState(), definitions)) return;
      dispatch({ type: "REMOVE_WIDGET", id });
    },
    [dispatch, definitions, getState]
  );

  const toggleVisibility = useCallback(
    (id: string) => {
      if (!getDefConstraint(id, "hideable", getState(), definitions)) return;
      dispatch({ type: "TOGGLE_VISIBILITY", id });
    },
    [dispatch, definitions, getState]
  );

  const resizeWidget = useCallback(
    (id: string, colSpan: number) => {
      if (!getDefConstraint(id, "resizable", getState(), definitions)) return;
      dispatch({ type: "RESIZE_WIDGET", id, colSpan });
    },
    [dispatch, definitions, getState]
  );

  const reorderWidgets = useCallback(
    (fromIndex: number, toIndex: number) => {
      const state = getState();
      const visible = [...state.widgets]
        .filter((w) => w.visible)
        .sort((a, b) => a.order - b.order);
      const source = visible[fromIndex];
      const target = visible[toIndex];
      if (source && isLocked(source.id, state, definitions)) return;
      if (target && isLocked(target.id, state, definitions)) return;
      dispatch({ type: "REORDER_WIDGETS", fromIndex, toIndex });
    },
    [dispatch, definitions, getState]
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

  const lockWidget = useCallback(
    (id: string) => dispatch({ type: "LOCK_WIDGET", id }),
    [dispatch]
  );

  const unlockWidget = useCallback(
    (id: string) => dispatch({ type: "UNLOCK_WIDGET", id }),
    [dispatch]
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), [dispatch]);

  const redo = useCallback(() => dispatch({ type: "REDO" }), [dispatch]);

  return useMemo(
    () => ({
      addWidget,
      removeWidget,
      toggleVisibility,
      resizeWidget,
      reorderWidgets,
      setMaxColumns,
      batchUpdate,
      updateWidgetConfig,
      lockWidget,
      unlockWidget,
      undo,
      redo,
    }),
    [addWidget, removeWidget, toggleVisibility, resizeWidget, reorderWidgets, setMaxColumns, batchUpdate, updateWidgetConfig, lockWidget, unlockWidget, undo, redo]
  );
}
