import { useCallback } from "react";
import type { ExternalDragSourceProps } from "../types/external-drag.ts";
import {
  setActiveExternalDrag,
  clearActiveExternalDrag,
  EXTERNAL_DRAG_MIME,
} from "./external-drag-registry.ts";
import { useDashboardStable } from "../state/use-dashboard.ts";

/**
 * Hook that returns props to make any element a drag source for adding
 * a widget to the dashboard.
 *
 * Spread the returned props onto the element you want to be draggable:
 *
 * ```tsx
 * function CatalogItem({ widgetType }: { widgetType: string }) {
 *   const dragProps = useExternalDragSource(widgetType);
 *   return <div {...dragProps}>Drag me</div>;
 * }
 * ```
 *
 * @param widgetType - Must match a `WidgetDefinition.type` registered on the provider.
 * @param options.colSpan - Override the definition's `defaultColSpan`.
 * @param options.config - Initial config for the new widget instance.
 */
export function useExternalDragSource(
  widgetType: string,
  options?: {
    colSpan?: number;
    config?: Record<string, unknown>;
    /** Called when the user starts dragging this item. */
    onDragStart?: () => void;
    /** Called when the drag ends (drop, cancel, or escape). */
    onDragEnd?: () => void;
  },
): ExternalDragSourceProps {
  const { definitions } = useDashboardStable();

  const userOnDragStart = options?.onDragStart;
  const userOnDragEnd = options?.onDragEnd;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const def = definitions.find((d) => d.type === widgetType);
      const colSpan = options?.colSpan ?? def?.defaultColSpan ?? 1;

      e.dataTransfer.setData(EXTERNAL_DRAG_MIME, JSON.stringify({ widgetType, colSpan }));
      e.dataTransfer.effectAllowed = "copy";

      setActiveExternalDrag({
        widgetType,
        colSpan,
        config: options?.config,
      });

      userOnDragStart?.();
    },
    [widgetType, options?.colSpan, options?.config, definitions, userOnDragStart],
  );

  const handleDragEnd = useCallback(
    () => {
      clearActiveExternalDrag();
      userOnDragEnd?.();
    },
    [userOnDragEnd],
  );

  return {
    draggable: true as const,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  };
}
