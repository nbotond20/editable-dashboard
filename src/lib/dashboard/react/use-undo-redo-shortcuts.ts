import { useEffect, useRef } from "react";
import type { DashboardAction } from "../types.ts";

/**
 * Registers a `keydown` listener on `containerRef` that dispatches UNDO/REDO
 * actions in response to Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
 *
 * The listener is only active when `enabled` is `true`.
 */
export function useUndoRedoShortcuts(
  enabled: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  dispatch: (action: DashboardAction) => void,
): void {
  const dispatchRef = useRef(dispatch);
  useEffect(() => { dispatchRef.current = dispatch; });

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
      dispatchRef.current({ type: isRedoKey ? "REDO" : "UNDO" });
    };

    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }, [enabled, containerRef]);
}
