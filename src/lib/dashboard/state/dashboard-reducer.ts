import type { DashboardAction, DashboardState, WidgetState } from "../types.ts";
import { lockFieldName } from "../locks.ts";

/**
 * Normalize order values to be sequential (0, 1, 2, ...) to prevent drift.
 * Visible widgets are ordered first (by their current order), followed by hidden widgets.
 */
function normalizeOrder(widgets: WidgetState[]): WidgetState[] {
  const visible = widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);
  const hidden = widgets.filter((w) => !w.visible).sort((a, b) => a.order - b.order);
  const ordered = [...visible, ...hidden];
  return ordered.map((w, i) => (w.order === i ? w : { ...w, order: i }));
}

export function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "ADD_WIDGET": {
      const newWidget: WidgetState = {
        id: crypto.randomUUID(),
        type: action.widgetType,
        colSpan: Math.min(action.colSpan, state.maxColumns),
        visible: true,
        order: 0,
        ...(action.config != null ? { config: action.config } : {}),
        ...(action.columnStart != null ? { columnStart: action.columnStart } : {}),
      };

      if (action.targetIndex != null) {
        const visible = state.widgets
          .filter((w) => w.visible)
          .sort((a, b) => a.order - b.order);
        const idx = Math.max(0, Math.min(action.targetIndex, visible.length));
        visible.splice(idx, 0, newWidget);
        const orderMap = new Map<string, number>();
        visible.forEach((w, i) => orderMap.set(w.id, i));
        let nextOrder = visible.length;
        const widgets = [...state.widgets, newWidget].map((w) => {
          const o = orderMap.get(w.id);
          if (o != null) return w.order === o ? w : { ...w, order: o };
          const newOrd = nextOrder++;
          return w.order === newOrd ? w : { ...w, order: newOrd };
        });
        return { ...state, widgets: normalizeOrder(widgets) };
      }

      const maxOrder = state.widgets.reduce(
        (max, w) => Math.max(max, w.order),
        -1
      );
      return { ...state, widgets: [...state.widgets, { ...newWidget, order: maxOrder + 1 }] };
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
        const newOrd = nextOrder++;
        return w.order === newOrd ? w : { ...w, order: newOrd };
      });

      return { ...state, widgets: normalizeOrder(reordered) };
    }

    case "SET_MAX_COLUMNS": {
      const mc = action.maxColumns;
      return {
        ...state,
        maxColumns: mc,
        widgets: state.widgets.map((w) => {
          const colSpan = Math.min(w.colSpan, mc);
          const columnStart =
            w.columnStart != null && w.columnStart + colSpan > mc
              ? undefined
              : w.columnStart;
          return { ...w, colSpan, columnStart };
        }),
      };
    }

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
      const field = lockFieldName(action.lockType);
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
