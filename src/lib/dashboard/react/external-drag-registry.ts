import type { ExternalDragItem } from "../types/external-drag.ts";

/**
 * Module-scoped registry for passing external drag data between the
 * drag source hook and the drop target hook.
 *
 * HTML5 DnD restricts `getData()` to the `drop` event only, so we use
 * this registry to communicate the full drag item during `dragenter` /
 * `dragover` where only `dataTransfer.types` is accessible.
 */
let activeItem: ExternalDragItem | null = null;

export function setActiveExternalDrag(item: ExternalDragItem): void {
  activeItem = item;
}

export function getActiveExternalDrag(): ExternalDragItem | null {
  return activeItem;
}

export function clearActiveExternalDrag(): void {
  activeItem = null;
}

/** Custom MIME type used to identify dashboard widget drags in `dataTransfer.types`. */
export const EXTERNAL_DRAG_MIME = "application/x-dashboard-widget";
