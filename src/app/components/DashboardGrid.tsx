import { useEffect, useMemo } from "react";
import { LayoutGroup, AnimatePresence, motion } from "motion/react";
import { useDashboard, useInsertionLines, useSourceGhost, useEmptySlots, useEmptySlotDragState, EXTERNAL_PHANTOM_ID, type WidgetState, type DragHandleProps, type EmptySlot, type InsertionInvalidReason } from "../../lib/dashboard/index.ts";
import { SPRINGS } from "../animation-config.ts";
import { WidgetSlot } from "./WidgetSlot.tsx";
import { InsertionLineMarker, UnanchoredInsertionLine, LineEndCap } from "./InsertionLineElement.tsx";

/** Hide the "Add a new widget" placeholder below this height so its content is never clipped. */
const MIN_EMPTY_SLOT_HEIGHT = 110;

const REASON_MESSAGES: Record<InsertionInvalidReason, { title: string; detail: string }> = {
  "only-full-width": { title: "Widget sizing not possible", detail: "This widget only comes in full width" },
  "resize-locked": { title: "Widget sizing not possible", detail: "A widget here is locked and can't make room" },
  "position-locked": { title: "Can't place here", detail: "A locked widget is in the way" },
  "column-overflow": { title: "Not enough space", detail: "This widget doesn't fit in this row" },
};

const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusCircleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
  </svg>
);

const InvalidIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);

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
  /** When true, render persistent "Add a new widget" affordances over free space. */
  editing?: boolean;
  /** Invoked when an empty-slot affordance is clicked. */
  onAddWidget?: (slot: EmptySlot) => void;
  children: (
    widget: WidgetState,
    slotProps: WidgetSlotCallbackProps
  ) => React.ReactNode;
}

export function DashboardGrid({ className, style, ghostClassName, sourceGhostClassName, animated = true, editing = false, onAddWidget, children }: DashboardGridProps) {
  const { state, layout, dragState, containerRef, phase } = useDashboard();
  const emptySlots = useEmptySlots();
  const slotDrag = useEmptySlotDragState();

  const draggedId = dragState.activeId;
  const draggedHeight = draggedId
    ? dragState.previewLayout?.positions.get(draggedId)?.height ??
      layout.positions.get(draggedId)?.height
    : undefined;

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

  const isLinesPlacement = dragState.intentType === "new-row"
    || dragState.intentType === "in-row-insert";
  const ghostClass = isLinesPlacement
    ? "dashboard-place-ghost"
    : (ghostClassName ?? "dashboard-drop-ghost");
  const ghostContent = isLinesPlacement ? (
    <div className="dashboard-place-ghost__inner">
      <CheckIcon />
      <span>Place widget</span>
    </div>
  ) : null;

  const ghostElement = ghostPos && (
    animated ? (
      <motion.div
        key="drop-ghost"
        className={ghostClass}
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
      >
        {ghostContent}
      </motion.div>
    ) : (
      <div
        key="drop-ghost"
        className={ghostClass}
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
      >
        {ghostContent}
      </div>
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

  const isDragging = phase !== "idle";
  const emptyElements = editing
    ? emptySlots.flatMap((slot) => {
        const ds =
          slotDrag && slotDrag.rowIndex === slot.rowIndex && slotDrag.columnStart === slot.columnStart
            ? slotDrag
            : null;
        const reason = ds?.state === "invalid" ? ds.reason : undefined;
        const slotHeight =
          ds?.state === "valid" && draggedHeight != null
            ? Math.max(slot.height, draggedHeight)
            : slot.height;
        if (!ds && slot.height < MIN_EMPTY_SLOT_HEIGHT) return [];
        const content = reason ? (
          <>
            <span className="dashboard-empty-slot__icon">
              <InvalidIcon />
            </span>
            <strong>{REASON_MESSAGES[reason].title}</strong>
            <span>{REASON_MESSAGES[reason].detail}</span>
          </>
        ) : ds?.state === "valid" ? (
          <>
            <span className="dashboard-empty-slot__icon">
              <CheckIcon />
            </span>
            <span>Drop to add here</span>
          </>
        ) : (
          <>
            <span className="dashboard-empty-slot__icon">
              <PlusCircleIcon />
            </span>
            <span>Add a new widget</span>
          </>
        );
        const key = `empty-${slot.rowIndex}-${slot.columnStart}`;
        const commonProps = {
          type: "button" as const,
          className: `dashboard-empty-slot${ds ? ` dashboard-empty-slot--${ds.state}` : ""}`,
          "data-testid": "empty-slot",
          "data-row-index": slot.rowIndex,
          "data-column-start": slot.columnStart,
          "data-drag-state": ds?.state,
          "data-reason": reason,
          disabled: isDragging,
          onClick: isDragging ? undefined : () => onAddWidget?.(slot),
        };
        const slotStyle = {
          position: "absolute" as const,
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slotHeight,
          pointerEvents: isDragging ? ("none" as const) : undefined,
        };
        return [
          animated ? (
            <motion.button
              key={key}
              {...commonProps}
              style={slotStyle}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SPRINGS.layout}
            >
              {content}
            </motion.button>
          ) : (
            <button key={key} {...commonProps} style={slotStyle}>
              {content}
            </button>
          ),
        ];
      })
    : null;

  const activeLine = lines.find((l) => l.isActive && !l.disabled);
  const endCap = activeLine ? <LineEndCap key={`cap-${activeLine.id}`} line={activeLine} /> : null;

  const placeGhostElement = editing && slotDrag?.state === "valid" ? null : ghostElement;

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
          <AnimatePresence>{emptyElements}</AnimatePresence>
          <AnimatePresence>{sourceGhostElement}</AnimatePresence>
          <AnimatePresence>{placeGhostElement}</AnimatePresence>
          <AnimatePresence mode="popLayout">{widgetElements}</AnimatePresence>
          <AnimatePresence>
            {unanchoredLines.map((line) => (
              <UnanchoredInsertionLine key={line.id} line={line} />
            ))}
          </AnimatePresence>
          {anchoredLines.map((line) => (
            <InsertionLineMarker key={`marker-${line.id}`} line={line} />
          ))}
          <AnimatePresence>{endCap}</AnimatePresence>
        </>
      ) : (
        <>
          {emptyElements}
          {sourceGhostElement}
          {placeGhostElement}
          {widgetElements}
          {unanchoredLines.map((line) => (
            <UnanchoredInsertionLine key={line.id} line={line} />
          ))}
          {anchoredLines.map((line) => (
            <InsertionLineMarker key={`marker-${line.id}`} line={line} />
          ))}
          {endCap}
        </>
      )}
    </div>
  );

  return animated ? <LayoutGroup>{container}</LayoutGroup> : container;
}
