import { useEffect } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";

/**
 * Registers a `keydown` listener on `containerRef` that dispatches UNDO/REDO
 * actions in response to Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
 *
 * The listener is only active when `enabled` is `true`.
 */
export function useUndoRedoShortcuts(
  enabled: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  engine: DragEngine,
): void {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      const isUndoKey =
        (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z";
      const isRedoKey =
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key === "z") || (!e.shiftKey && e.key === "y"));

      if (!isUndoKey && !isRedoKey) return;
      e.preventDefault();
      engine.dispatch({ type: isRedoKey ? "REDO" : "UNDO" });
    };

    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }, [enabled, containerRef, engine]);
}
