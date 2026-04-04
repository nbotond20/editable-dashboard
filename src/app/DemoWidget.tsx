import { memo } from "react";
import type { WidgetState, DragHandleProps } from "../lib/dashboard/index.ts";
import { useDashboardStable } from "../lib/dashboard/index.ts";
import { StatsWidget } from "./widgets/StatsWidget.tsx";
import { ChartWidget } from "./widgets/ChartWidget.tsx";
import { TableWidget } from "./widgets/TableWidget.tsx";
import { NotesWidget } from "./widgets/NotesWidget.tsx";
import { CalendarWidget } from "./widgets/CalendarWidget.tsx";

const widgetComponents: Record<string, React.FC> = {
  stats: StatsWidget,
  chart: ChartWidget,
  table: TableWidget,
  notes: NotesWidget,
  calendar: CalendarWidget,
};

const widgetLabels: Record<string, string> = {
  stats: "Statistics",
  chart: "Chart",
  table: "Team",
  notes: "Notes",
  calendar: "Calendar",
};

interface DemoWidgetProps {
  widget: WidgetState;
  dragHandleProps: DragHandleProps;
  isDragging: boolean;
  colSpan: number;
  maxColumns: number;
  resize: (colSpan: number) => void;
  remove: () => void;
  isLongPressing: boolean;
}

const GripIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5" cy="3" r="1.2"/><circle cx="11" cy="3" r="1.2"/>
    <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
    <circle cx="5" cy="13" r="1.2"/><circle cx="11" cy="13" r="1.2"/>
  </svg>
);

const ColumnsIcon = ({ n }: { n: number }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    {n === 1 && <rect x="2" y="2" width="10" height="10" rx="1.5"/>}
    {n === 2 && <><rect x="1" y="2" width="5" height="10" rx="1.5"/><rect x="8" y="2" width="5" height="10" rx="1.5"/></>}
    {n === 3 && <><rect x="0.5" y="2" width="3.5" height="10" rx="1"/><rect x="5.25" y="2" width="3.5" height="10" rx="1"/><rect x="10" y="2" width="3.5" height="10" rx="1"/></>}
  </svg>
);

export const DemoWidget = memo(function DemoWidget({
  widget,
  dragHandleProps,
  isDragging,
  colSpan,
  maxColumns,
  resize,
  remove,
  isLongPressing,
}: DemoWidgetProps) {
  const { actions, isWidgetLockActive } = useDashboardStable();
  const Component = widgetComponents[widget.type];
  const label = widgetLabels[widget.type] ?? widget.type;
  const positionLocked = isWidgetLockActive(widget.id, "position");
  const resizeLocked = isWidgetLockActive(widget.id, "resize");
  const removeLocked = isWidgetLockActive(widget.id, "remove");

  const widgetClass = [
    "dash-widget",
    positionLocked && "dash-widget--locked",
    isDragging && "dash-widget--dragging",
    isLongPressing && "dash-widget--long-pressing",
  ].filter(Boolean).join(" ");

  return (
    <div className={widgetClass}>
      <div className="dash-widget__header">
        <div
          {...dragHandleProps}
          style={{ ...dragHandleProps.style }}
          className={`dash-widget__drag-handle ${positionLocked ? "dash-widget__drag-handle--locked" : ""}`}
        >
          <GripIcon />
        </div>
        <span style={{ flex: 1 }} className="dash-label-emphasis">{label}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {maxColumns > 1 && !resizeLocked && (
            <div className="dash-toggle-group" role="group" aria-label="Widget width">
              {Array.from({ length: maxColumns }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={`dash-toggle-item ${colSpan === n ? "dash-toggle-item--active" : ""}`}
                  onClick={() => resize(n)}
                  aria-label={`${n} column${n > 1 ? "s" : ""} wide`}
                >
                  <ColumnsIcon n={n} />
                </button>
              ))}
            </div>
          )}
          <button
            className={`dash-icon-btn ${positionLocked ? "dash-icon-btn--active" : ""}`}
            aria-label={positionLocked ? "Unlock position" : "Lock position"}
            onClick={() => actions.setWidgetLock(widget.id, "position", !positionLocked)}
          >
            {positionLocked ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
            )}
          </button>
          <button
            className={`dash-icon-btn ${resizeLocked ? "dash-icon-btn--active" : ""}`}
            aria-label={resizeLocked ? "Unlock resize" : "Lock resize"}
            onClick={() => actions.setWidgetLock(widget.id, "resize", !resizeLocked)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
              {resizeLocked && <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2.5"/>}
            </svg>
          </button>
          <button
            className={`dash-icon-btn ${removeLocked ? "dash-icon-btn--active" : ""}`}
            aria-label={removeLocked ? "Unlock remove" : "Lock remove"}
            onClick={() => actions.setWidgetLock(widget.id, "remove", !removeLocked)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              {removeLocked ? (
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              ) : (
                <line x1="15" y1="9" x2="9" y2="15"/>
              )}
            </svg>
          </button>
          {!removeLocked && (
            <button
              className="dash-icon-btn dash-icon-btn--danger"
              aria-label="Remove"
              onClick={remove}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>
      <div className="dash-widget__body">
        {Component ? <Component /> : <span className="dash-body-sm">Unknown widget: {widget.type}</span>}
      </div>
    </div>
  );
});
