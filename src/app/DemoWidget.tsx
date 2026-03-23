import type { WidgetState, DragHandleProps } from "../lib/dashboard/index.ts";
import { useDashboard } from "../lib/dashboard/index.ts";
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
  toggleVisibility: () => void;
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

export function DemoWidget({
  widget,
  dragHandleProps,
  isDragging,
  colSpan,
  maxColumns,
  resize,
  remove,
  toggleVisibility,
}: DemoWidgetProps) {
  const { actions, isWidgetLocked, isWidgetRemovable, isWidgetHideable, isWidgetResizable } = useDashboard();
  const Component = widgetComponents[widget.type];
  const label = widgetLabels[widget.type] ?? widget.type;
  const locked = isWidgetLocked(widget.id);
  const removable = isWidgetRemovable(widget.id);
  const hideable = isWidgetHideable(widget.id);
  const resizable = isWidgetResizable(widget.id);

  const widgetClass = [
    "dash-widget",
    locked && "dash-widget--locked",
    isDragging && "dash-widget--dragging",
  ].filter(Boolean).join(" ");

  return (
    <div className={widgetClass}>
      <div className="dash-widget__header">
        <div
          {...dragHandleProps}
          style={{ ...dragHandleProps.style }}
          className={`dash-widget__drag-handle ${locked ? "dash-widget__drag-handle--locked" : ""}`}
        >
          <GripIcon />
        </div>
        <span style={{ flex: 1 }} className="dash-label-emphasis">{label}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {maxColumns > 1 && resizable && (
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
            className="dash-icon-btn"
            aria-label={locked ? "Unlock" : "Lock"}
            onClick={() => locked ? actions.unlockWidget(widget.id) : actions.lockWidget(widget.id)}
          >
            {locked ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
            )}
          </button>
          {hideable && (
            <button
              className="dash-icon-btn"
              aria-label="Hide"
              onClick={toggleVisibility}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          )}
          {removable && (
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
}
