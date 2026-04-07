import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboard } from "../state/use-dashboard.ts";

export interface TrashZoneResult {
  /** Spread onto the element that acts as the trash zone. */
  ref: React.RefCallback<HTMLElement>;
  /** True when any drag (internal or external) is in progress. Use to show/hide the zone. */
  isActive: boolean;
  /** True when the dragged widget is currently hovering over the trash zone. */
  isOver: boolean;
}

/**
 * Headless hook that turns any element into a trash/cancel drop zone.
 *
 * - During an **internal** pointer drag, if the widget is released over the
 *   trash zone it is removed from the dashboard.
 * - During an **external** HTML5 drag, if the widget is dropped on the trash
 *   zone the add is cancelled.
 *
 * ```tsx
 * function MyTrashZone() {
 *   const { ref, isActive, isOver } = useTrashZone();
 *   if (!isActive) return null;
 *   return (
 *     <div ref={ref} style={{ background: isOver ? "red" : "gray" }}>
 *       Drop here to remove
 *     </div>
 *   );
 * }
 * ```
 */
export function useTrashZone(): TrashZoneResult {
  const { phase, registerTrashZone } = useDashboard();
  const elRef = useRef<HTMLElement | null>(null);
  const [isOver, setIsOver] = useState(false);

  const isActive =
    phase === "dragging" ||
    phase === "keyboard-dragging" ||
    phase === "external-dragging";

  const ref = useCallback(
    (node: HTMLElement | null) => {
      elRef.current = node;
      registerTrashZone(node);
    },
    [registerTrashZone],
  );

  useEffect(() => {
    if (!isActive) setIsOver(false);
  }, [isActive]);

  useEffect(() => {
    if (phase !== "dragging") return;

    function handlePointerMove(e: PointerEvent) {
      const el = elRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setIsOver(
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom,
      );
    }

    document.addEventListener("pointermove", handlePointerMove);
    return () => document.removeEventListener("pointermove", handlePointerMove);
  }, [phase]);

  useEffect(() => {
    if (phase !== "external-dragging") return;
    const el = elRef.current;
    if (!el) return;

    let enterCount = 0;

    function handleDragEnter(e: DragEvent) {
      e.preventDefault();
      enterCount++;
      if (enterCount === 1) setIsOver(true);
    }

    function handleDragLeave() {
      enterCount--;
      if (enterCount <= 0) {
        enterCount = 0;
        setIsOver(false);
      }
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
    }

    el.addEventListener("dragenter", handleDragEnter);
    el.addEventListener("dragleave", handleDragLeave);
    el.addEventListener("dragover", handleDragOver);

    return () => {
      enterCount = 0;
      el.removeEventListener("dragenter", handleDragEnter);
      el.removeEventListener("dragleave", handleDragLeave);
      el.removeEventListener("dragover", handleDragOver);
    };
  }, [phase]);

  return { ref, isActive, isOver };
}
