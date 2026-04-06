import { useCallback, useRef, useEffect } from "react";
import type {
  DashboardAction,
  DashboardState,
  WidgetState,
} from "../types.ts";
import type { CommitSource } from "../engine/types.ts";

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
          const prevIds = new Set(prevState.widgets.map((w) => w.id));
          const newWidget = nextState.widgets.find((w) => !prevIds.has(w.id));
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

  /**
   * Fires mutation callbacks for drag-committed operations (reorder, swap,
   * auto-resize, resize-toggle, column-pin). This is called from the engine's
   * `onCommit` callback for drag operations.
   */
  const fireDragCommitCallbacks = useCallback(
    (source: CommitSource, prevState: DashboardState, nextState: DashboardState) => {
      if (nextState === prevState) return;
      if (source.type !== "drag-operation") return;

      const { operation } = source;

      switch (operation.type) {
        case "reorder": {
          const visible = [...prevState.widgets]
            .filter((w) => w.visible)
            .sort((a, b) => a.order - b.order);
          const movedWidget = visible[operation.fromIndex];
          if (movedWidget && operation.fromIndex !== operation.toIndex) {
            onWidgetReorderRef.current?.({
              widgetId: movedWidget.id,
              fromIndex: operation.fromIndex,
              toIndex: operation.toIndex,
            });
          }
          break;
        }
        case "swap": {
          const prevSourceWidget = prevState.widgets.find((w) => w.id === operation.sourceId);
          const prevTargetWidget = prevState.widgets.find((w) => w.id === operation.targetId);
          const nextSourceWidget = nextState.widgets.find((w) => w.id === operation.sourceId);
          const nextTargetWidget = nextState.widgets.find((w) => w.id === operation.targetId);
          if (prevSourceWidget && nextSourceWidget && prevSourceWidget.order !== nextSourceWidget.order) {
            onWidgetReorderRef.current?.({
              widgetId: operation.sourceId,
              fromIndex: prevSourceWidget.order,
              toIndex: nextSourceWidget.order,
            });
          }
          if (prevTargetWidget && nextTargetWidget && prevTargetWidget.order !== nextTargetWidget.order) {
            onWidgetReorderRef.current?.({
              widgetId: operation.targetId,
              fromIndex: prevTargetWidget.order,
              toIndex: nextTargetWidget.order,
            });
          }
          break;
        }
        case "auto-resize": {
          const prevSource = prevState.widgets.find((w) => w.id === operation.sourceId);
          const nextSource = nextState.widgets.find((w) => w.id === operation.sourceId);
          if (prevSource && nextSource && prevSource.colSpan !== nextSource.colSpan) {
            onWidgetResizeRef.current?.({
              widgetId: operation.sourceId,
              previousColSpan: prevSource.colSpan,
              newColSpan: nextSource.colSpan,
            });
          }
          const prevTarget = prevState.widgets.find((w) => w.id === operation.targetId);
          const nextTarget = nextState.widgets.find((w) => w.id === operation.targetId);
          if (prevTarget && nextTarget && prevTarget.colSpan !== nextTarget.colSpan) {
            onWidgetResizeRef.current?.({
              widgetId: operation.targetId,
              previousColSpan: prevTarget.colSpan,
              newColSpan: nextTarget.colSpan,
            });
          }
          break;
        }
        case "resize-toggle": {
          const prevWidget = prevState.widgets.find((w) => w.id === operation.id);
          const nextWidget = nextState.widgets.find((w) => w.id === operation.id);
          if (prevWidget && nextWidget && prevWidget.colSpan !== nextWidget.colSpan) {
            onWidgetResizeRef.current?.({
              widgetId: operation.id,
              previousColSpan: prevWidget.colSpan,
              newColSpan: nextWidget.colSpan,
            });
          }
          break;
        }
        case "column-pin": {
          const visible = [...prevState.widgets]
            .filter((w) => w.visible)
            .sort((a, b) => a.order - b.order);
          const sourceIdx = visible.findIndex((w) => w.id === operation.sourceId);
          if (sourceIdx >= 0 && sourceIdx !== operation.targetIndex) {
            onWidgetReorderRef.current?.({
              widgetId: operation.sourceId,
              fromIndex: sourceIdx,
              toIndex: operation.targetIndex,
            });
          }
          break;
        }
      }
    },
    [],
  );

  return { fireMutationCallbacks, fireDragCommitCallbacks };
}
