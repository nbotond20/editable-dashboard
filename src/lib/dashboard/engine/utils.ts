import type { WidgetState } from "../types.ts";
import type { Point, DropZone } from "./types.ts";

export function getVisibleSorted(widgets: readonly WidgetState[]): WidgetState[] {
  return widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);
}

export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function zonesEqual(a: DropZone | null, b: DropZone | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "gap":
      return (
        a.index === (b as typeof a).index &&
        a.beforeId === (b as typeof a).beforeId &&
        a.afterId === (b as typeof a).afterId
      );
    case "widget":
      return a.targetId === (b as typeof a).targetId;
    case "empty":
      return a.column === (b as typeof a).column;
    case "outside":
      return true;
  }
}

export function getPinnedIds(widgets: readonly WidgetState[]): Set<string> | undefined {
  const pinned = new Set<string>();
  for (const w of widgets) {
    if (w.visible && w.columnStart != null) pinned.add(w.id);
  }
  return pinned.size > 0 ? pinned : undefined;
}
