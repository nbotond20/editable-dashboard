import { useCallback } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";

export function useKeyboardAdapter(engine: DragEngine) {
  const handleKeyDown = useCallback(
    (widgetId: string, e: React.KeyboardEvent) => {
      const phase = engine.getSnapshot().phase;
      const now = performance.now();

      if (phase.type === "idle") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          engine.send({ type: "KEY_PICKUP", id: widgetId, timestamp: now });
        }
        return;
      }

      if (
        phase.type === "keyboard-dragging" &&
        phase.sourceId === widgetId
      ) {
        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            engine.send({ type: "KEY_MOVE", direction: "up", timestamp: now });
            break;
          case "ArrowDown":
            e.preventDefault();
            engine.send({ type: "KEY_MOVE", direction: "down", timestamp: now });
            break;
          case "ArrowLeft":
            e.preventDefault();
            engine.send({ type: "KEY_RESIZE", direction: "shrink", timestamp: now });
            break;
          case "ArrowRight":
            e.preventDefault();
            engine.send({ type: "KEY_RESIZE", direction: "grow", timestamp: now });
            break;
          case " ":
          case "Enter":
            e.preventDefault();
            engine.send({ type: "KEY_DROP", timestamp: now });
            break;
          case "Escape":
            e.preventDefault();
            engine.send({ type: "KEY_CANCEL", timestamp: now });
            break;
        }
      }
    },
    [engine],
  );

  return { handleKeyDown };
}
