import { useCallback, useRef, useEffect } from "react";
import type {
  DashboardAction,
  DashboardState,
  WidgetState,
} from "../types.ts";

export interface MutationCallbackProps {
  onWidgetAdd?: (event: { widget: WidgetState }) => void;
  onWidgetRemove?: (event: { widgetId: string }) => void;
  onWidgetResize?: (event: {
    widgetId: string;
    previousColSpan: number;
    newColSpan: number;
  }) => void;
  onWidgetReorder?: (event: {
    widgetId: string;
    fromIndex: number;
    toIndex: number;
  }) => void;
  onWidgetConfigChange?: (event: {
    widgetId: string;
    config: Record<string, unknown>;
  }) => void;
}

/**
 * Extracts mutation callback refs and returns a stable `fireMutationCallbacks` function.
 *
 * Each callback prop is stored in a ref so the returned function never changes identity
 * and never causes re-renders when callers change.
 */
export function useMutationCallbacks(props: MutationCallbackProps) {
  const onWidgetAddRef = useRef(props.onWidgetAdd);
  useEffect(() => { onWidgetAddRef.current = props.onWidgetAdd; });
  const onWidgetRemoveRef = useRef(props.onWidgetRemove);
  useEffect(() => { onWidgetRemoveRef.current = props.onWidgetRemove; });
  const onWidgetResizeRef = useRef(props.onWidgetResize);
  useEffect(() => { onWidgetResizeRef.current = props.onWidgetResize; });
  const onWidgetReorderRef = useRef(props.onWidgetReorder);
  useEffect(() => { onWidgetReorderRef.current = props.onWidgetReorder; });
  const onWidgetConfigChangeRef = useRef(props.onWidgetConfigChange);
  useEffect(() => { onWidgetConfigChangeRef.current = props.onWidgetConfigChange; });

  const fireMutationCallbacks = useCallback(
    (action: DashboardAction, prevState: DashboardState, nextState: DashboardState) => {
      if (nextState === prevState) return;

      switch (action.type) {
        case "ADD_WIDGET": {
          const newWidget = nextState.widgets.find(
            (w) => !prevState.widgets.some((pw) => pw.id === w.id),
          );
          if (newWidget) {
            onWidgetAddRef.current?.({ widget: newWidget });
          }
          break;
        }
        case "REMOVE_WIDGET":
          onWidgetRemoveRef.current?.({ widgetId: action.id });
          break;
        case "RESIZE_WIDGET": {
          const prevWidget = prevState.widgets.find((w) => w.id === action.id);
          const nextWidget = nextState.widgets.find((w) => w.id === action.id);
          if (prevWidget && nextWidget && prevWidget.colSpan !== nextWidget.colSpan) {
            onWidgetResizeRef.current?.({
              widgetId: action.id,
              previousColSpan: prevWidget.colSpan,
              newColSpan: nextWidget.colSpan,
            });
          }
          break;
        }
        case "REORDER_WIDGETS":
          if (action.fromIndex !== action.toIndex) {
            const visible = [...prevState.widgets]
              .filter((w) => w.visible)
              .sort((a, b) => a.order - b.order);
            const movedWidget = visible[action.fromIndex];
            if (movedWidget) {
              onWidgetReorderRef.current?.({
                widgetId: movedWidget.id,
                fromIndex: action.fromIndex,
                toIndex: action.toIndex,
              });
            }
          }
          break;
        case "UPDATE_WIDGET_CONFIG":
          onWidgetConfigChangeRef.current?.({
            widgetId: action.id,
            config: action.config,
          });
          break;
      }
    },
    [],
  );

  return fireMutationCallbacks;
}
