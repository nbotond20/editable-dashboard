import { useEffect, useRef } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";
import type { WidgetDefinition } from "../types/widget.ts";
import {
  getActiveExternalDrag,
  clearActiveExternalDrag,
  EXTERNAL_DRAG_MIME,
} from "./external-drag-registry.ts";

/**
 * Internal hook that listens for HTML5 drag-and-drop events at the document
 * level and translates them into engine events when the pointer is over the
 * dashboard container.
 *
 * Document-level listeners are necessary because consumer UI (overlays,
 * side panels, modals) can sit on top of the dashboard grid in the z-order.
 *
 * We unconditionally `preventDefault()` on `dragover` for recognised dashboard
 * drags so the browser's internal DnD state machine treats the whole page as a
 * valid drop surface. Without this, elements that sit above the grid (overlays,
 * backdrops) cause the browser to show a "not-allowed" cursor and suppress the
 * `drop` event entirely.
 *
 * Only active when `enabled` is true.
 */
export function useExternalDropTarget(
  engine: DragEngine,
  containerRef: React.RefObject<HTMLDivElement | null>,
  definitions: WidgetDefinition[],
  enabled: boolean,
): void {
  const engineRef = useRef(engine);
  useEffect(() => { engineRef.current = engine; });

  const definitionsRef = useRef(definitions);
  useEffect(() => { definitionsRef.current = definitions; });

  const rafIdRef = useRef<number | null>(null);
  const isOverContainerRef = useRef(false);
  const hasEnteredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let tickRunning = false;

    function startTickLoop() {
      if (tickRunning) return;
      tickRunning = true;
      function tick() {
        if (!tickRunning) return;
        engineRef.current.send({ type: "TICK", timestamp: performance.now() });
        rafIdRef.current = requestAnimationFrame(tick);
      }
      rafIdRef.current = requestAnimationFrame(tick);
    }

    function stopTickLoop() {
      tickRunning = false;
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }

    function isDashboardDrag(e: DragEvent): boolean {
      return e.dataTransfer?.types.includes(EXTERNAL_DRAG_MIME) ?? false;
    }

    function isPointerOverContainer(e: DragEvent): boolean {
      const container = containerRef.current;
      if (!container) return false;
      const rect = container.getBoundingClientRect();
      return (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
    }

    function getContainerRelativePos(e: DragEvent): { x: number; y: number } {
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      return {
        x: e.clientX - rect.left + container.scrollLeft,
        y: e.clientY - rect.top + container.scrollTop,
      };
    }

    function handleDragOver(e: DragEvent) {
      if (!isDashboardDrag(e)) return;

      e.preventDefault();

      const over = isPointerOverContainer(e);

      if (over) {
        e.dataTransfer!.dropEffect = "copy";
      } else {
        e.dataTransfer!.dropEffect = "none";
      }

      if (over && !hasEnteredRef.current) {
        hasEnteredRef.current = true;
        isOverContainerRef.current = true;

        const item = getActiveExternalDrag();
        if (!item) return;

        const def = definitionsRef.current.find((d) => d.type === item.widgetType);
        const colSpan = item.colSpan ?? def?.defaultColSpan ?? 1;
        const pos = getContainerRelativePos(e);

        engineRef.current.send({
          type: "EXTERNAL_ENTER",
          widgetType: item.widgetType,
          colSpan,
          position: pos,
          timestamp: performance.now(),
          config: item.config,
        });

        startTickLoop();
      } else if (hasEnteredRef.current) {
        isOverContainerRef.current = over;
        const pos = getContainerRelativePos(e);
        engineRef.current.send({
          type: "EXTERNAL_MOVE",
          position: pos,
          timestamp: performance.now(),
        });
      }
    }

    function handleDrop(e: DragEvent) {
      if (!isDashboardDrag(e)) return;
      e.preventDefault();

      if (hasEnteredRef.current) {
        stopTickLoop();
        engineRef.current.send({
          type: "EXTERNAL_DROP",
          timestamp: performance.now(),
        });
      }
      hasEnteredRef.current = false;
      isOverContainerRef.current = false;
      clearActiveExternalDrag();
    }

    function handleDragEnd() {
      if (hasEnteredRef.current) {
        stopTickLoop();
        engineRef.current.send({
          type: "EXTERNAL_LEAVE",
          timestamp: performance.now(),
        });
      }
      hasEnteredRef.current = false;
      isOverContainerRef.current = false;
      clearActiveExternalDrag();
    }

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragend", handleDragEnd);

    return () => {
      stopTickLoop();
      hasEnteredRef.current = false;
      isOverContainerRef.current = false;
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragend", handleDragEnd);
    };
  }, [enabled, containerRef]);
}
