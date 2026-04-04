import { useRef, useEffect } from "react";
import type { DragPhase, CommittedOperation } from "../engine/types.ts";

export interface PhaseCallbackProps {
  phase: DragPhase;
  onDragStart?: (event: { widgetId: string; phase: "pointer" | "keyboard" }) => void;
  onDragEnd?: (event: {
    widgetId: string;
    operation: CommittedOperation;
    cancelled: boolean;
  }) => void;
}

/**
 * Tracks phase transitions and fires onDragStart / onDragEnd callbacks
 * at the appropriate moments.
 *
 * - `onDragStart` fires when phase enters "dragging" or "keyboard-dragging".
 * - `onDragEnd` fires when phase returns to "idle" from "dropping",
 *   "dragging", or "keyboard-dragging".
 */
export function usePhaseCallbacks({
  phase,
  onDragStart,
  onDragEnd,
}: PhaseCallbackProps): void {
  const onDragStartRef = useRef(onDragStart);
  useEffect(() => { onDragStartRef.current = onDragStart; });
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => { onDragEndRef.current = onDragEnd; });

  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = phase;
    prevPhaseRef.current = curr;

    if (curr.type === "dragging" && prev.type !== "dragging") {
      onDragStartRef.current?.({ widgetId: curr.sourceId, phase: "pointer" });
    } else if (curr.type === "keyboard-dragging" && prev.type !== "keyboard-dragging") {
      onDragStartRef.current?.({ widgetId: curr.sourceId, phase: "keyboard" });
    }

    if (curr.type === "idle" && prev.type === "dropping") {
      onDragEndRef.current?.({
        widgetId: prev.sourceId,
        operation: prev.operation,
        cancelled: prev.operation.type === "cancelled",
      });
    }

    if (curr.type === "idle" && prev.type === "dragging") {
      const cancelledOp: CommittedOperation = { type: "cancelled" };
      onDragEndRef.current?.({
        widgetId: prev.sourceId,
        operation: cancelledOp,
        cancelled: true,
      });
    }

    if (curr.type === "idle" && prev.type === "keyboard-dragging") {
      const wasCancelled = prev.currentIndex === prev.originalIndex && prev.currentColSpan === prev.originalColSpan;
      const operation: CommittedOperation = wasCancelled
        ? { type: "cancelled" }
        : { type: "reorder", fromIndex: prev.originalIndex, toIndex: prev.currentIndex };
      onDragEndRef.current?.({
        widgetId: prev.sourceId,
        operation,
        cancelled: wasCancelled,
      });
    }
  }, [phase]);
}
