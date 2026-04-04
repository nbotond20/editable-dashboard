import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  DashboardProvider,
  useDashboardStable,
  serializeDashboard,
  deserializeDashboard,
  type WidgetDefinition,
  type WidgetState,
  type DashboardState,
} from "../lib/dashboard/index.ts";
import { DashboardGrid } from "./components/DashboardGrid.tsx";
import { DashboardGridStatic } from "./components/DashboardGridStatic.tsx";
import { DemoWidget } from "./DemoWidget.tsx";
import { WidgetCatalog } from "./WidgetCatalog.tsx";
import "./App.css";

const STORAGE_KEY = "editable-dashboard-state";

const definitions: WidgetDefinition[] = [
  { type: "stats", label: "Statistics", defaultColSpan: 1 },
  { type: "chart", label: "Chart", defaultColSpan: 2 },
  { type: "table", label: "Team Members", defaultColSpan: 2 },
  { type: "notes", label: "Quick Notes", defaultColSpan: 1 },
  { type: "calendar", label: "Calendar", defaultColSpan: 1 },
];

const initialWidgets: WidgetState[] = [
  { id: crypto.randomUUID(), type: "stats", colSpan: 1, visible: true, order: 0 },
  { id: crypto.randomUUID(), type: "chart", colSpan: 2, visible: true, order: 1 },
  { id: crypto.randomUUID(), type: "notes", colSpan: 1, visible: true, order: 2 },
  { id: crypto.randomUUID(), type: "calendar", colSpan: 1, visible: true, order: 3 },
];

function DashboardContent({ onStateChange }: { onStateChange?: (state: DashboardState) => void }) {
  const { state, actions, definitions: defs, canUndo, canRedo } = useDashboardStable();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [animated, setAnimated] = useState(true);
  const Grid = animated ? DashboardGrid : DashboardGridStatic;

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const activeTypes = useMemo(
    () => new Set(state.widgets.filter((w) => w.visible).map((w) => w.type)),
    [state.widgets]
  );

  const handleAdd = useCallback(
    (type: string) => {
      actions.addWidget(type);
    },
    [actions]
  );

  const closeCatalog = useCallback(() => setCatalogOpen(false), []);

  const renderWidget = useCallback(
    (widget: WidgetState, slotProps: { dragHandleProps: any; isDragging: boolean; colSpan: number; resize: (colSpan: number) => void; remove: () => void; isLongPressing: boolean }) => (
      <DemoWidget
        widget={widget}
        dragHandleProps={slotProps.dragHandleProps}
        isDragging={slotProps.isDragging}
        colSpan={slotProps.colSpan}
        maxColumns={state.maxColumns}
        resize={slotProps.resize}
        remove={slotProps.remove}
        isLongPressing={slotProps.isLongPressing}
      />
    ),
    [state.maxColumns]
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="dash-header">
        <h1 className="dash-heading-md">Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="dash-btn dash-btn--outline"
              onClick={() => actions.undo()}
              disabled={!canUndo}
              aria-label="Undo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 0 1 15.36-6.36"/></svg>
              Undo
            </button>
            <button
              className="dash-btn dash-btn--outline"
              onClick={() => actions.redo()}
              disabled={!canRedo}
              aria-label="Redo"
            >
              Redo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 0 0-15.36-6.36"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`dash-btn ${state.maxColumns === n ? "dash-btn--primary" : "dash-btn--outline"}`}
                onClick={() => actions.setMaxColumns(n)}
              >
                {n} col{n > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <button
            className={`dash-btn ${animated ? "dash-btn--outline" : "dash-btn--primary"}`}
            onClick={() => setAnimated((a) => !a)}
          >
            {animated ? "Animations: On" : "Animations: Off"}
          </button>
          <button
            className="dash-btn dash-btn--primary"
            onClick={() => setCatalogOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add Widget
          </button>
        </div>
      </header>

      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Grid style={{ width: "100%" }}>
          {renderWidget}
        </Grid>

      </main>

      <WidgetCatalog
        open={catalogOpen}
        onClose={closeCatalog}
        definitions={defs}
        activeTypes={activeTypes}
        onAdd={handleAdd}
      />
    </div>
  );
}

function loadSavedState(): { widgets: WidgetState[]; maxColumns: number } | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const data = JSON.parse(raw);
    const state = deserializeDashboard(data, definitions);
    return { widgets: state.widgets, maxColumns: state.maxColumns };
  } catch {
    return undefined;
  }
}

export default function App() {
  const [saved] = useState(() => loadSavedState());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleStateChange = useCallback((state: DashboardState) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const serialized = serializeDashboard(state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      } catch { /* ignore storage errors */ }
    }, 300);
  }, []);

  return (
    <DashboardProvider
      definitions={definitions}
      initialWidgets={saved?.widgets ?? initialWidgets}
      maxColumns={saved?.maxColumns ?? 2}
      gap={16}
      dragConfig={{
        touchMoveTolerance: 20,
        autoScrollEdgeSize: 80,
      }}
    >
      <DashboardContent onStateChange={handleStateChange} />
    </DashboardProvider>
  );
}
