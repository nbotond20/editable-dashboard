import { useRef, useCallback, useEffect } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";
import type { PointerType } from "../engine/types.ts";

export function usePointerAdapter(
  engine: DragEngine,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const rafRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      cleanupRef.current?.();
    };
  }, []);

  const startDrag = useCallback(
    (
      id: string,
      pointerId: number,
      clientPos: { x: number; y: number },
      _element: HTMLElement,
      pointerType?: string,
    ) => {
      const container = containerRef.current;
      if (!container) return;

      let activePointerId: number | null = pointerId;

      const rect = container.getBoundingClientRect();
      const position = {
        x: clientPos.x - rect.left + container.scrollLeft,
        y: clientPos.y - rect.top + container.scrollTop,
      };

      engine.send({
        type: "SET_CONTAINER",
        width: rect.width,
      });

      engine.send({
        type: "POINTER_DOWN",
        id,
        position,
        timestamp: performance.now(),
        pointerType: (pointerType ?? "mouse") as PointerType,
      });

      // Define handlers inside callback (not during render)
      function handlePointerMove(e: PointerEvent) {
        if (e.pointerId !== activePointerId) return;
        const c = containerRef.current;
        if (!c) return;

        const r = c.getBoundingClientRect();
        engine.send({
          type: "POINTER_MOVE",
          position: {
            x: e.clientX - r.left + c.scrollLeft,
            y: e.clientY - r.top + c.scrollTop,
          },
          timestamp: performance.now(),
        });
      }

      function handlePointerUp(e: PointerEvent) {
        if (e.pointerId !== activePointerId) return;
        engine.send({ type: "POINTER_UP", timestamp: performance.now() });
        cleanup();
      }

      function handlePointerCancel(e: PointerEvent) {
        if (e.pointerId !== activePointerId) return;
        engine.send({ type: "POINTER_CANCEL", timestamp: performance.now() });
        cleanup();
      }

      function cleanup() {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
        cancelAnimationFrame(rafRef.current);
        isDraggingRef.current = false;
        activePointerId = null;
        cleanupRef.current = null;
      }

      cleanupRef.current = cleanup;

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerCancel);

      // Start RAF tick loop for dwell timing
      isDraggingRef.current = true;
      const tick = () => {
        if (!isDraggingRef.current) return;
        engine.send({ type: "TICK", timestamp: performance.now() });

        const phase = engine.getSnapshot().phase;
        if (
          phase.type === "pending" ||
          phase.type === "dragging" ||
          phase.type === "dropping"
        ) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          isDraggingRef.current = false;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [engine, containerRef],
  );

  return { startDrag };
}
