import type { DashboardAction, DashboardState, WidgetState } from "../types.ts";

export function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "ADD_WIDGET": {
      const maxOrder = state.widgets.reduce(
        (max, w) => Math.max(max, w.order),
        -1
      );
      const newWidget: WidgetState = {
        id: crypto.randomUUID(),
        type: action.widgetType,
        colSpan: Math.min(action.colSpan, state.maxColumns),
        visible: true,
        order: maxOrder + 1,
        ...(action.config != null ? { config: action.config } : {}),
      };
      return { ...state, widgets: [...state.widgets, newWidget] };
    }

    case "REMOVE_WIDGET":
      return {
        ...state,
        widgets: state.widgets.filter((w) => w.id !== action.id),
      };

    case "TOGGLE_VISIBILITY":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, visible: !w.visible } : w
        ),
      };

    case "RESIZE_WIDGET":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id
            ? { ...w, colSpan: Math.max(1, Math.min(action.colSpan, state.maxColumns)), columnStart: undefined }
            : w
        ),
      };

    case "SWAP_WIDGETS": {
      const sourceWidget = state.widgets.find(w => w.id === action.sourceId);
      const targetWidget = state.widgets.find(w => w.id === action.targetId);
      if (!sourceWidget || !targetWidget) return state;
      return {
        ...state,
        widgets: state.widgets.map(w => {
          if (w.id === action.sourceId) return { ...w, order: targetWidget.order, columnStart: undefined };
          if (w.id === action.targetId) return { ...w, order: sourceWidget.order, columnStart: undefined };
          return w;
        }),
      };
    }

    case "REORDER_WIDGETS": {
      const sorted = [...state.widgets].sort((a, b) => a.order - b.order);
      const visible = sorted.filter((w) => w.visible);
      const movedWidget = visible[action.fromIndex];
      if (!movedWidget) return state;
      visible.splice(action.fromIndex, 1);
      visible.splice(action.toIndex, 0, movedWidget);

      const orderMap = new Map<string, number>();
      visible.forEach((w, i) => orderMap.set(w.id, i));

      let nextOrder = visible.length;
      const reordered = state.widgets.map((w) => {
        if (orderMap.has(w.id)) {
          const isMovedWidget = w.id === movedWidget.id;
          return {
            ...w,
            order: orderMap.get(w.id)!,
            ...(isMovedWidget ? { columnStart: undefined } : {}),
          };
        }
        return { ...w, order: nextOrder++ };
      });

      return { ...state, widgets: reordered };
    }

    case "SET_CONTAINER_WIDTH":
      return { ...state, containerWidth: action.width };

    case "SET_MAX_COLUMNS":
      return {
        ...state,
        maxColumns: action.maxColumns,
        widgets: state.widgets.map((w) => ({
          ...w,
          colSpan: Math.min(w.colSpan, action.maxColumns),
        })),
      };

    case "BATCH_UPDATE":
      return { ...state, widgets: action.widgets };

    case "UPDATE_WIDGET_CONFIG":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id
            ? { ...w, config: { ...w.config, ...action.config } }
            : w
        ),
      };

    case "LOCK_WIDGET":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, locked: true } : w
        ),
      };

    case "UNLOCK_WIDGET":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, locked: undefined } : w
        ),
      };

    default:
      return state;
  }
}
