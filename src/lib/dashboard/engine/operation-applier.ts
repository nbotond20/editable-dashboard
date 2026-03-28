import type { CommittedOperation } from "./types.ts";
import type { DashboardState } from "../types.ts";
import { getVisibleSorted } from "./types.ts";
import { dashboardReducer } from "../state/dashboard-reducer.ts";

export function applyOperation(
  state: DashboardState,
  operation: CommittedOperation
): DashboardState {
  switch (operation.type) {
    case "reorder":
      return dashboardReducer(state, {
        type: "REORDER_WIDGETS",
        fromIndex: operation.fromIndex,
        toIndex: operation.toIndex,
      });

    case "swap":
      return dashboardReducer(state, {
        type: "SWAP_WIDGETS",
        sourceId: operation.sourceId,
        targetId: operation.targetId,
      });

    case "auto-resize": {
      let result = dashboardReducer(state, {
        type: "RESIZE_WIDGET",
        id: operation.sourceId,
        colSpan: operation.sourceSpan,
      });

      result = dashboardReducer(result, {
        type: "RESIZE_WIDGET",
        id: operation.targetId,
        colSpan: operation.targetSpan,
      });

      const visibleSorted = getVisibleSorted(result.widgets);
      const sourceVisibleIdx = visibleSorted.findIndex(
        (w) => w.id === operation.sourceId
      );
      if (sourceVisibleIdx === -1) return result;

      result = dashboardReducer(result, {
        type: "REORDER_WIDGETS",
        fromIndex: sourceVisibleIdx,
        toIndex: operation.targetIndex,
      });

      return result;
    }

    case "column-pin": {
      const visibleSorted = getVisibleSorted(state.widgets);
      const sourceVisibleIdx = visibleSorted.findIndex(
        (w) => w.id === operation.sourceId
      );
      if (sourceVisibleIdx === -1) return state;

      let result = dashboardReducer(state, {
        type: "REORDER_WIDGETS",
        fromIndex: sourceVisibleIdx,
        toIndex: operation.targetIndex,
      });

      result = {
        ...result,
        widgets: result.widgets.map((w) =>
          w.id === operation.sourceId
            ? { ...w, columnStart: operation.column }
            : w
        ),
      };

      return result;
    }

    case "resize-toggle":
      return dashboardReducer(state, {
        type: "RESIZE_WIDGET",
        id: operation.id,
        colSpan: operation.newSpan,
      });

    case "cancelled":
      return state;
  }
}
