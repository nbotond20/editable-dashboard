import { useCallback, useRef, useState, useEffect } from "react";
import type {
  KeyboardDragState,
  WidgetState,
  WidgetDefinition,
} from "../types.ts";

interface UseKeyboardDragOptions {
  getWidgets: () => WidgetState[];
  definitions: WidgetDefinition[];
  maxColumns: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onResize: (id: string, colSpan: number) => void;
  announce: (message: string) => void;
}

const INITIAL_STATE: KeyboardDragState = {
  isKeyboardDragging: false,
  keyboardDragId: null,
  keyboardTargetIndex: null,
};

function getVisibleSorted(widgets: WidgetState[]): WidgetState[] {
  return widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);
}

function getWidgetLabel(
  widgetId: string,
  widgets: WidgetState[],
  definitions: WidgetDefinition[]
): string {
  const widget = widgets.find((w) => w.id === widgetId);
  if (!widget) return "Unknown";
  const def = definitions.find((d) => d.type === widget.type);
  return def?.label ?? widget.type;
}

export function useKeyboardDrag(options: UseKeyboardDragOptions) {
  const {
    getWidgets,
    definitions,
    maxColumns,
    onReorder,
    onResize,
    announce,
  } = options;

  const [kbState, setKbState] = useState<KeyboardDragState>(INITIAL_STATE);
  const originalIndexRef = useRef<number | null>(null);

  // Prevent default scroll behavior for arrow keys while keyboard dragging
  useEffect(() => {
    if (!kbState.isKeyboardDragging) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [kbState.isKeyboardDragging]);

  const pickUp = useCallback(
    (widgetId: string) => {
      const widgets = getWidgets();
      const visible = getVisibleSorted(widgets);
      const index = visible.findIndex((w) => w.id === widgetId);
      if (index === -1) return;

      originalIndexRef.current = index;
      const label = getWidgetLabel(widgetId, widgets, definitions);
      const total = visible.length;

      setKbState({
        isKeyboardDragging: true,
        keyboardDragId: widgetId,
        keyboardTargetIndex: index,
      });

      announce(
        `Picked up ${label}, position ${index + 1} of ${total}`
      );
    },
    [getWidgets, definitions, announce]
  );

  const moveUp = useCallback(() => {
    setKbState((prev) => {
      if (!prev.isKeyboardDragging || prev.keyboardTargetIndex === null) return prev;
      if (prev.keyboardTargetIndex <= 0) return prev;

      const newIndex = prev.keyboardTargetIndex - 1;
      const widgets = getWidgets();
      const visible = getVisibleSorted(widgets);
      const total = visible.length;

      onReorder(prev.keyboardTargetIndex, newIndex);
      announce(`Moved to position ${newIndex + 1} of ${total}`);

      return { ...prev, keyboardTargetIndex: newIndex };
    });
  }, [getWidgets, onReorder, announce]);

  const moveDown = useCallback(() => {
    setKbState((prev) => {
      if (!prev.isKeyboardDragging || prev.keyboardTargetIndex === null) return prev;
      const widgets = getWidgets();
      const visible = getVisibleSorted(widgets);
      if (prev.keyboardTargetIndex >= visible.length - 1) return prev;

      const newIndex = prev.keyboardTargetIndex + 1;
      const total = visible.length;

      onReorder(prev.keyboardTargetIndex, newIndex);
      announce(`Moved to position ${newIndex + 1} of ${total}`);

      return { ...prev, keyboardTargetIndex: newIndex };
    });
  }, [getWidgets, onReorder, announce]);

  const resizeLeft = useCallback(() => {
    setKbState((prev) => {
      if (!prev.isKeyboardDragging || !prev.keyboardDragId) return prev;
      const widgets = getWidgets();
      const widget = widgets.find((w) => w.id === prev.keyboardDragId);
      if (!widget) return prev;
      const def = definitions.find((d) => d.type === widget.type);
      const minSpan = def?.minColSpan ?? 1;
      const newSpan = Math.max(minSpan, widget.colSpan - 1);
      if (newSpan === widget.colSpan) return prev;

      onResize(prev.keyboardDragId, newSpan);
      announce(`Column span changed to ${newSpan}`);
      return prev;
    });
  }, [getWidgets, definitions, onResize, announce]);

  const resizeRight = useCallback(() => {
    setKbState((prev) => {
      if (!prev.isKeyboardDragging || !prev.keyboardDragId) return prev;
      const widgets = getWidgets();
      const widget = widgets.find((w) => w.id === prev.keyboardDragId);
      if (!widget) return prev;
      const def = definitions.find((d) => d.type === widget.type);
      const maxSpan = def?.maxColSpan ?? maxColumns;
      const newSpan = Math.min(maxSpan, maxColumns, widget.colSpan + 1);
      if (newSpan === widget.colSpan) return prev;

      onResize(prev.keyboardDragId, newSpan);
      announce(`Column span changed to ${newSpan}`);
      return prev;
    });
  }, [getWidgets, definitions, maxColumns, onResize, announce]);

  const drop = useCallback(() => {
    setKbState((prev) => {
      if (!prev.isKeyboardDragging || !prev.keyboardDragId) return prev;
      const widgets = getWidgets();
      const visible = getVisibleSorted(widgets);
      const label = getWidgetLabel(prev.keyboardDragId, widgets, definitions);
      const currentIndex = prev.keyboardTargetIndex ?? 0;

      announce(
        `Dropped ${label} at position ${currentIndex + 1} of ${visible.length}`
      );

      originalIndexRef.current = null;
      return INITIAL_STATE;
    });
  }, [getWidgets, definitions, announce]);

  const cancel = useCallback(() => {
    setKbState((prev) => {
      if (!prev.isKeyboardDragging || prev.keyboardTargetIndex === null) {
        return INITIAL_STATE;
      }

      const origIndex = originalIndexRef.current;
      if (origIndex !== null && origIndex !== prev.keyboardTargetIndex) {
        onReorder(prev.keyboardTargetIndex, origIndex);
      }

      announce("Reorder cancelled");
      originalIndexRef.current = null;
      return INITIAL_STATE;
    });
  }, [onReorder, announce]);

  const handleKeyDown = useCallback(
    (widgetId: string, e: React.KeyboardEvent) => {
      if (kbState.isKeyboardDragging && kbState.keyboardDragId === widgetId) {
        // Widget is being dragged -- handle movement keys
        switch (e.key) {
          case " ":
          case "Enter":
            e.preventDefault();
            drop();
            break;
          case "Escape":
            e.preventDefault();
            cancel();
            break;
          case "ArrowUp":
            e.preventDefault();
            moveUp();
            break;
          case "ArrowDown":
            e.preventDefault();
            moveDown();
            break;
          case "ArrowLeft":
            e.preventDefault();
            resizeLeft();
            break;
          case "ArrowRight":
            e.preventDefault();
            resizeRight();
            break;
        }
      } else if (!kbState.isKeyboardDragging) {
        // Not dragging -- Space/Enter picks up
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          pickUp(widgetId);
        }
      }
    },
    [kbState, pickUp, drop, cancel, moveUp, moveDown, resizeLeft, resizeRight]
  );

  return { kbState, handleKeyDown };
}
