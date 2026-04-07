import type { DragState, DragConfig } from "../types.ts";
import type { DragEngineSnapshot, DragEngineConfig } from "../engine/types.ts";

/**
 * Derives the public `DragState` from the current engine snapshot.
 *
 * This is a pure function — it reads `phase`, `intent`, and `previewLayout`
 * from the snapshot and returns a plain object suitable for the context value.
 */
export function buildDragState(snapshot: DragEngineSnapshot): DragState {
  const phase = snapshot.phase;

  if (phase.type === "dragging") {
    return {
      activeId: phase.sourceId,
      dropTargetIndex: snapshot.intent?.type === "reorder" ? snapshot.intent.targetIndex : null,
      previewColSpan: snapshot.intent?.type === "auto-resize" ? snapshot.intent.sourceSpan : null,
      previewLayout: snapshot.previewLayout,
      isLongPressing: false,
      longPressTargetId: null,
      isExternalDrag: false,
      externalWidgetType: null,
    };
  }

  if (phase.type === "keyboard-dragging") {
    return {
      activeId: phase.sourceId,
      dropTargetIndex: phase.currentIndex,
      previewColSpan: null,
      previewLayout: snapshot.previewLayout,
      isLongPressing: false,
      longPressTargetId: null,
      isExternalDrag: false,
      externalWidgetType: null,
    };
  }

  if (phase.type === "external-dragging") {
    return {
      activeId: null,
      dropTargetIndex: snapshot.intent?.type === "reorder" ? snapshot.intent.targetIndex : null,
      previewColSpan: null,
      previewLayout: snapshot.previewLayout,
      isLongPressing: false,
      longPressTargetId: null,
      isExternalDrag: true,
      externalWidgetType: phase.widgetType,
    };
  }

  if (phase.type === "pending") {
    return {
      activeId: null,
      dropTargetIndex: null,
      previewColSpan: null,
      previewLayout: null,
      isLongPressing: phase.pointerType === "touch",
      longPressTargetId: phase.pointerType === "touch" ? phase.sourceId : null,
      isExternalDrag: false,
      externalWidgetType: null,
    };
  }

  return {
    activeId: null,
    dropTargetIndex: null,
    previewColSpan: null,
    previewLayout: null,
    isLongPressing: false,
    longPressTargetId: null,
    isExternalDrag: false,
    externalWidgetType: null,
  };
}

/**
 * Constructs a partial `DragEngineConfig` from user-facing props.
 *
 * Only keys that are explicitly provided (non-`undefined`) in `dragConfig`
 * are spread into the result, so the engine can apply its own defaults for
 * the rest.
 */
export function buildEngineConfig(
  maxColumns: number,
  gap: number,
  dragConfig?: DragConfig,
): Partial<DragEngineConfig> {
  return {
    maxColumns,
    gap,
    ...(dragConfig?.activationThreshold != null && { activationThreshold: dragConfig.activationThreshold }),
    ...(dragConfig?.touchActivationDelay != null && { touchActivationDelay: dragConfig.touchActivationDelay }),
    ...(dragConfig?.touchMoveTolerance != null && { touchMoveTolerance: dragConfig.touchMoveTolerance }),
    ...(dragConfig?.swapDwellMs != null && { swapDwellMs: dragConfig.swapDwellMs }),
    ...(dragConfig?.resizeDwellMs != null && { resizeDwellMs: dragConfig.resizeDwellMs }),
    ...(dragConfig?.dropAnimationDuration != null && { dropAnimationDuration: dragConfig.dropAnimationDuration }),
  };
}
