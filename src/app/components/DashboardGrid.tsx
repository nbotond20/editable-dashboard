import { useEffect, useMemo } from "react";
import { LayoutGroup, AnimatePresence, motion } from "motion/react";
import { useDashboard, useInsertionLines, useSourceGhost, EXTERNAL_PHANTOM_ID, type WidgetState, type DragHandleProps } from "../../lib/dashboard/index.ts";
import { SPRINGS } from "../animation-config.ts";
import { WidgetSlot } from "./WidgetSlot.tsx";
import { InsertionLineMarker, UnanchoredInsertionLine } from "./InsertionLineElement.tsx";

interface WidgetSlotCallbackProps {
  key: string;
  widget: WidgetState;
  dragHandleProps: DragHandleProps;
  isDragging: boolean;
  colSpan: number;
  resize: (colSpan: number) => void;
  remove: () => void;
  isLongPressing: boolean;
}

interface DashboardGridProps {
  className?: string;
  style?: React.CSSProperties;
  ghostClassName?: string;
  sourceGhostClassName?: string;
  animated?: boolean;
  children: (
    widget: WidgetState,
    slotProps: WidgetSlotCallbackProps
  ) => React.ReactNode;
}

export function DashboardGrid({ className, style, ghostClassName, sourceGhostClassName, animated = true, children }: DashboardGridProps) {
  const { state, layout, dragState, containerRef, phase } = useDashboard();

  const visibleWidgets = useMemo(
    () =>
      state.widgets
        .filter((w) => w.visible)
        .sort((a, b) => a.order - b.order),
    [state.widgets]
  );

  useEffect(() => {
    if (phase === "pending" || phase === "dragging" || phase === "external-dragging") {
      document.body.classList.add("dash-dragging");
    } else {
      document.body.classList.remove("dash-dragging");
    }
    return () => document.body.classList.remove("dash-dragging");
  }, [phase]);

  const lines = useInsertionLines();
  const sourceGhost = useSourceGhost();
  const unanchoredLines = useMemo(
    () => lines.filter((l) => !l.segments || l.segments.length === 0 || l.segments.every((s) => s.anchorId == null)),
    [lines]
  );
  const anchoredLines = useMemo(
    () => lines.filter((l) => l.segments && l.segments.some((s) => s.anchorId != null)),
    [lines]
  );

  const activeLayout = dragState.previewLayout ?? layout;
  const containerHeight = activeLayout.totalHeight;

  const ghostId = dragState.activeId ?? (dragState.isExternalDrag ? EXTERNAL_PHANTOM_ID : null);
  const ghostPos = ghostId && dragState.previewLayout
    ? dragState.previewLayout.positions.get(ghostId)
    : null;

  const isResizeIntent = dragState.intentType === "auto-resize"
    || dragState.intentType === "empty-row-maximize";

  const ghostElement = ghostPos && (
    animated ? (
      <motion.div
        key="drop-ghost"
        className={ghostClassName ?? "dashboard-drop-ghost"}
        data-testid="drop-ghost"
        data-ghost-x={ghostPos.x}
        data-ghost-y={ghostPos.y}
        data-ghost-width={ghostPos.width}
        data-ghost-height={ghostPos.height}
        initial={{
          opacity: 0,
          x: ghostPos.x,
          y: ghostPos.y,
          width: ghostPos.width,
          height: ghostPos.height,
        }}
        animate={{
          opacity: 1,
          x: ghostPos.x,
          y: ghostPos.y,
          width: ghostPos.width,
          height: ghostPos.height,
        }}
        exit={{ opacity: 0 }}
        transition={{
          ...SPRINGS.layout,
          width: isResizeIntent ? SPRINGS.layout : { duration: 0 },
        }}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
      />
    ) : (
      <div
        key="drop-ghost"
        className={ghostClassName ?? "dashboard-drop-ghost"}
        data-testid="drop-ghost"
        data-ghost-x={ghostPos.x}
        data-ghost-y={ghostPos.y}
        data-ghost-width={ghostPos.width}
        data-ghost-height={ghostPos.height}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${ghostPos.x}px, ${ghostPos.y}px)`,
          width: ghostPos.width,
          height: ghostPos.height,
          pointerEvents: "none",
        }}
      />
    )
  );

  const sourceGhostElement = sourceGhost && (
    animated ? (
      <motion.div
        key="source-ghost"
        className={sourceGhostClassName ?? "dashboard-source-ghost"}
        data-testid="source-ghost"
        data-source-ghost-x={sourceGhost.x}
        data-source-ghost-y={sourceGhost.y}
        data-source-ghost-width={sourceGhost.width}
        data-source-ghost-height={sourceGhost.height}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: sourceGhost.x,
          top: sourceGhost.y,
          width: sourceGhost.width,
          height: sourceGhost.height,
          pointerEvents: "none",
        }}
      />
    ) : (
      <div
        key="source-ghost"
        className={sourceGhostClassName ?? "dashboard-source-ghost"}
        data-testid="source-ghost"
        data-source-ghost-x={sourceGhost.x}
        data-source-ghost-y={sourceGhost.y}
        data-source-ghost-width={sourceGhost.width}
        data-source-ghost-height={sourceGhost.height}
        style={{
          position: "absolute",
          left: sourceGhost.x,
          top: sourceGhost.y,
          width: sourceGhost.width,
          height: sourceGhost.height,
          pointerEvents: "none",
        }}
      />
    )
  );

  const widgetElements = visibleWidgets.map((widget) => (
    <WidgetSlot key={widget.id} widget={widget} animated={animated}>
      {children}
    </WidgetSlot>
  ));

  const container = (
    <div
      ref={containerRef}
      className={className}
      data-testid="dashboard-grid"
      data-phase={phase}
      data-max-columns={state.maxColumns}
      data-gap={state.gap}
      data-widget-count={visibleWidgets.length}
      style={{
        position: "relative",
        height: containerHeight > 0 ? containerHeight : "auto",
        minHeight: 100,
        ...style,
      }}
    >
      {animated ? (
        <>
          <AnimatePresence>{sourceGhostElement}</AnimatePresence>
          <AnimatePresence>{ghostElement}</AnimatePresence>
          <AnimatePresence mode="popLayout">{widgetElements}</AnimatePresence>
          <AnimatePresence>
            {unanchoredLines.map((line) => (
              <UnanchoredInsertionLine key={line.id} line={line} />
            ))}
          </AnimatePresence>
          {anchoredLines.map((line) => (
            <InsertionLineMarker key={`marker-${line.id}`} line={line} />
          ))}
        </>
      ) : (
        <>
          {sourceGhostElement}
          {ghostElement}
          {widgetElements}
          {unanchoredLines.map((line) => (
            <UnanchoredInsertionLine key={line.id} line={line} />
          ))}
          {anchoredLines.map((line) => (
            <InsertionLineMarker key={`marker-${line.id}`} line={line} />
          ))}
        </>
      )}
    </div>
  );

  return animated ? <LayoutGroup>{container}</LayoutGroup> : container;
}
