import { createContext, useContext } from "react";
import type { DragState } from "../types.ts";

export interface DragContextValue {
  dragState: DragState;
  startDrag: (
    id: string,
    pointerId: number,
    initialPos: { x: number; y: number },
    element: HTMLElement
  ) => void;
  updateDragPointer: (pos: { x: number; y: number }) => void;
  endDrag: () => void;
}

export const DragContext = createContext<DragContextValue | null>(null);

export function useDragContext() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("useDragContext must be used within DashboardProvider");
  return ctx;
}
