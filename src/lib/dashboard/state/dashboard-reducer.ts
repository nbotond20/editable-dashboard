import type { DashboardAction, DashboardState, LockType, WidgetState } from "../types.ts";

/**
 * Normalize order values to be sequential (0, 1, 2, ...) to prevent drift.
 * Visible widgets are ordered first (by their current order), followed by hidden widgets.
 */
function normalizeOrder(widgets: WidgetState[]): WidgetState[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  return sorted.map((w, i) => (w.order === i ? w : { ...w, order: i }));
}

function lockField(lockType: LockType): "lockPosition" | "lockResize" | "lockRemove" {
  switch (lockType) {
    case "position": return "lockPosition";
    case "resize": return "lockResize";
    case "remove": return "lockRemove";
  }
}

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

      return { ...state, widgets: normalizeOrder(reordered) };
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
      return { ...state, widgets: normalizeOrder(action.widgets) };

    case "UPDATE_WIDGET_CONFIG":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id
            ? { ...w, config: { ...w.config, ...action.config } }
            : w
        ),
      };

    case "SET_WIDGET_LOCK": {
      const field = lockField(action.lockType);
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id
            ? { ...w, [field]: action.locked || undefined }
            : w
        ),
      };
    }

    case "SHOW_WIDGET":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, visible: true } : w
        ),
      };

    case "HIDE_WIDGET":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, visible: false } : w
        ),
      };

    default:
      return state;
  }
}
