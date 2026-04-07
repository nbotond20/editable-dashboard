/**
 * Describes a widget being dragged from an external source (e.g. a catalog panel).
 */
export interface ExternalDragItem {
  /** The widget type (must match a WidgetDefinition.type). */
  widgetType: string;
  /** Column span override. Falls back to the definition's `defaultColSpan`. */
  colSpan?: number;
  /** Initial config to attach to the new widget. */
  config?: Record<string, unknown>;
}

/**
 * Props returned by {@link useExternalDragSource} to spread onto a draggable element.
 */
export interface ExternalDragSourceProps {
  draggable: true;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

/**
 * Event payload fired after an external widget is dropped onto the dashboard.
 */
export interface ExternalDropEvent {
  widgetType: string;
  widgetId: string;
  colSpan: number;
  targetIndex: number;
  columnStart?: number;
  config?: Record<string, unknown>;
}
