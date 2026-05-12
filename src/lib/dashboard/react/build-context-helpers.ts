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
  const intent = snapshot.intent;
  const swapTargetId =
    intent?.type === "deferred-swap" ? intent.targetId : null;

  if (phase.type === "dragging") {
    return {
      activeId: phase.sourceId,
      dropTargetIndex: intent?.type === "reorder" ? intent.targetIndex : null,
      previewColSpan: intent?.type === "auto-resize" ? intent.sourceSpan : null,
      previewLayout: snapshot.previewLayout,
      isLongPressing: false,
      longPressTargetId: null,
      isExternalDrag: false,
      externalWidgetType: null,
      intentType: intent?.type ?? null,
      swapTargetId,
      sourceGhost: snapshot.sourceGhost,
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
      intentType: "reorder",
      swapTargetId: null,
      sourceGhost: null,
    };
  }

  if (phase.type === "external-dragging") {
    return {
      activeId: null,
      dropTargetIndex: intent?.type === "reorder" ? intent.targetIndex : null,
      previewColSpan: null,
      previewLayout: snapshot.previewLayout,
      isLongPressing: false,
      longPressTargetId: null,
      isExternalDrag: true,
      externalWidgetType: phase.widgetType,
      intentType: intent?.type ?? null,
      swapTargetId,
      sourceGhost: null,
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
      intentType: null,
      swapTargetId: null,
      sourceGhost: null,
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
    intentType: null,
    swapTargetId: null,
    sourceGhost: null,
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
    ...(dragConfig?.dropMode != null && { dropMode: dragConfig.dropMode }),
    ...(dragConfig?.lineSnapRadius != null && { lineSnapRadius: dragConfig.lineSnapRadius }),
    ...(dragConfig?.lineCornerInset != null && { lineCornerInset: dragConfig.lineCornerInset }),
    ...(dragConfig?.lineProximityRadius != null && { lineProximityRadius: dragConfig.lineProximityRadius }),
  };
}
