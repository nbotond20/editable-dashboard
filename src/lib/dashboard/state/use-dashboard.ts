import { createContext, useContext, useCallback, useMemo } from "react";
import type {
  DashboardContextValue,
  DashboardActions,
  DashboardState,
  WidgetDefinition,
  LockType,
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

function lockField(lockType: LockType): "lockPosition" | "lockResize" | "lockRemove" {
  switch (lockType) {
    case "position": return "lockPosition";
    case "resize": return "lockResize";
    case "remove": return "lockRemove";
  }
}

export function isLockActive(
  id: string,
  lockType: LockType,
  state: DashboardState,
  definitions: WidgetDefinition[]
): boolean {
  const widget = state.widgets.find((w) => w.id === id);
  if (!widget) return false;
  const field = lockField(lockType);
  if (widget[field] != null) return widget[field]!;
  const def = definitions.find((d) => d.type === widget.type);
  return def?.[field] === true;
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
      if (isLockActive(id, "remove", getState(), definitions)) return;
      dispatch({ type: "REMOVE_WIDGET", id });
    },
    [dispatch, definitions, getState]
  );

  const resizeWidget = useCallback(
    (id: string, colSpan: number) => {
      if (isLockActive(id, "resize", getState(), definitions)) return;
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
      if (source && isLockActive(source.id, "position", state, definitions)) return;
      if (target && isLockActive(target.id, "position", state, definitions)) return;
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
      setWidgetLock,
      undo,
      redo,
    }),
    [addWidget, removeWidget, resizeWidget, reorderWidgets, setMaxColumns, batchUpdate, updateWidgetConfig, setWidgetLock, undo, redo]
  );
}
