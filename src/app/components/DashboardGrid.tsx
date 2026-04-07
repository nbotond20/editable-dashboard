import { useEffect, useMemo } from "react";
import { LayoutGroup, AnimatePresence, motion } from "motion/react";
import { useDashboard, EXTERNAL_PHANTOM_ID, type WidgetState, type DragHandleProps } from "../../lib/dashboard/index.ts";
import { LAYOUT_SPRING } from "../animation-config.ts";
import { WidgetSlot } from "./WidgetSlot.tsx";

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
  children: (
    widget: WidgetState,
    slotProps: WidgetSlotCallbackProps
  ) => React.ReactNode;
}

export function DashboardGrid({ className, style, ghostClassName, children }: DashboardGridProps) {
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

  const activeLayout = dragState.previewLayout ?? layout;
  const containerHeight = activeLayout.totalHeight;

  const ghostId = dragState.activeId ?? (dragState.isExternalDrag ? EXTERNAL_PHANTOM_ID : null);
  const ghostPos = ghostId && dragState.previewLayout
    ? dragState.previewLayout.positions.get(ghostId)
    : null;

  return (
    <LayoutGroup>
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
        <AnimatePresence>
          {ghostPos && (
            <motion.div
              key="drop-ghost"
              className={ghostClassName ?? "dashboard-drop-ghost"}
              data-testid="drop-ghost"
              data-ghost-x={ghostPos.x}
              data-ghost-y={ghostPos.y}
              data-ghost-width={ghostPos.width}
              data-ghost-height={ghostPos.height}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                x: ghostPos.x,
                y: ghostPos.y,
                width: ghostPos.width,
                height: ghostPos.height,
              }}
              exit={{ opacity: 0 }}
              transition={LAYOUT_SPRING}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {visibleWidgets.map((widget) => (
            <WidgetSlot key={widget.id} widget={widget}>
              {children}
            </WidgetSlot>
          ))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
