import { useRef, useCallback, useEffect } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";
import type { PointerType } from "../engine/types.ts";

/**
 * Creates an object that manages pointer event listeners for a drag session.
 *
 * - `attach()` adds the event listeners to the document.
 * - `detach()` removes listeners and releases pointer capture (called on pointerUp).
 * - `cleanup()` does full cleanup including RAF cancellation (called on pointerCancel or unmount).
 */
function createPointerListeners(
  engine: DragEngine,
  containerRef: React.RefObject<HTMLElement | null>,
  element: HTMLElement,
  clientPosRef: React.MutableRefObject<{ x: number; y: number } | null>,
  pointerId: number,
  rafRef: React.MutableRefObject<number>,
  isDraggingRef: React.MutableRefObject<boolean>,
  cleanupRef: React.MutableRefObject<(() => void) | null>,
): { attach(): void; detach(): void; cleanup(): void } {
  let activePointerId: number | null = pointerId;

  function handlePointerMove(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    const c = containerRef.current;
    if (!c) return;

    clientPosRef.current = { x: e.clientX, y: e.clientY };

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
    detach();
  }

  function handlePointerCancel(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    engine.send({ type: "POINTER_CANCEL", timestamp: performance.now() });
    cleanup();
  }

  function preventContextMenu(e: Event) { e.preventDefault(); }
  function preventSelectStart(e: Event) { e.preventDefault(); }

  function removeAllListeners() {
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("pointercancel", handlePointerCancel);
    document.removeEventListener("contextmenu", preventContextMenu);
    document.removeEventListener("selectstart", preventSelectStart);
    if (activePointerId != null) {
      try { element.releasePointerCapture(activePointerId); } catch { /* already released */ }
    }
    clientPosRef.current = null;
    activePointerId = null;
  }

  function attach() {
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("selectstart", preventSelectStart);
  }

  function detach() {
    removeAllListeners();
    cleanupRef.current = cleanup;
  }

  function cleanup() {
    removeAllListeners();
    cancelAnimationFrame(rafRef.current);
    isDraggingRef.current = false;
    cleanupRef.current = null;
  }

  return { attach, detach, cleanup };
}

export function usePointerAdapter(
  engine: DragEngine,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const rafRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  /** Raw viewport-relative pointer position — used by useAutoScroll. */
  const clientPosRef = useRef<{ x: number; y: number } | null>(null);

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
      element: HTMLElement,
      pointerType?: string,
    ) => {
      const container = containerRef.current;
      if (!container) return;

      cleanupRef.current?.();

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

      clientPosRef.current = clientPos;

      try {
        element.setPointerCapture(pointerId);
      } catch { /* expected for synthetic events */ }

      const listeners = createPointerListeners(
        engine, containerRef, element, clientPosRef,
        pointerId, rafRef, isDraggingRef, cleanupRef,
      );
      cleanupRef.current = listeners.cleanup;
      listeners.attach();

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

  return { startDrag, clientPosRef };
}
