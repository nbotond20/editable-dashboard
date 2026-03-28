import { useMemo } from "react";
import { useDashboard, type WidgetState, type DragHandleProps } from "../../lib/dashboard/index.ts";
import { WidgetSlotStatic } from "./WidgetSlotStatic.tsx";

interface WidgetSlotCallbackProps {
  key: string;
  widget: WidgetState;
  dragHandleProps: DragHandleProps;
  isDragging: boolean;
  colSpan: number;
  resize: (colSpan: number) => void;
  remove: () => void;
  toggleVisibility: () => void;
}

interface DashboardGridStaticProps {
  className?: string;
  style?: React.CSSProperties;
  ghostClassName?: string;
  children: (
    widget: WidgetState,
    slotProps: WidgetSlotCallbackProps
  ) => React.ReactNode;
}

export function DashboardGridStatic({ className, style, ghostClassName, children }: DashboardGridStaticProps) {
  const { state, layout, dragState, containerRef, phase } = useDashboard();

  const visibleWidgets = useMemo(
    () =>
      state.widgets
        .filter((w) => w.visible)
        .sort((a, b) => a.order - b.order),
    [state.widgets]
  );

  const activeLayout = dragState.previewLayout ?? layout;
  const containerHeight = activeLayout.totalHeight;

  const ghostPos = dragState.activeId && dragState.previewLayout
    ? dragState.previewLayout.positions.get(dragState.activeId)
    : null;

  return (
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
      {ghostPos && (
        <div
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
      )}

      {visibleWidgets.map((widget) => (
        <WidgetSlotStatic key={widget.id} widget={widget}>
          {children}
        </WidgetSlotStatic>
      ))}
    </div>
  );
}
