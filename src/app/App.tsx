import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  DashboardProvider,
  useDashboardStable,
  serializeDashboard,
  deserializeDashboard,
  type WidgetDefinition,
  type WidgetState,
  type DashboardState,
  type DragHandleProps,
  useTrashZone,
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

const DRAG_CONFIG = {
  touchMoveTolerance: 20,
  autoScrollEdgeSize: 80,
} as const;

interface DashboardContentProps {
  /**
   * When provided, column selector is driven by the parent (controlled mode).
   * When omitted, falls back to actions.setMaxColumns (uncontrolled mode).
   */
  maxColumns?: number;
  onMaxColumnsChange?: (n: number) => void;
}

function DashboardContent({ maxColumns: controlledMaxColumns, onMaxColumnsChange }: DashboardContentProps) {
  const { state, actions, definitions: defs, canUndo, canRedo } = useDashboardStable();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [animated, setAnimated] = useState(true);
  const Grid = animated ? DashboardGrid : DashboardGridStatic;

  const maxColumns = controlledMaxColumns ?? state.maxColumns;
  const setMaxColumns = onMaxColumnsChange ?? actions.setMaxColumns;

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
    (widget: WidgetState, slotProps: { dragHandleProps: DragHandleProps; isDragging: boolean; colSpan: number; resize: (colSpan: number) => void; remove: () => void; isLongPressing: boolean }) => (
      <DemoWidget
        widget={widget}
        dragHandleProps={slotProps.dragHandleProps}
        isDragging={slotProps.isDragging}
        colSpan={slotProps.colSpan}
        maxColumns={maxColumns}
        resize={slotProps.resize}
        remove={slotProps.remove}
        isLongPressing={slotProps.isLongPressing}
      />
    ),
    [maxColumns]
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
                className={`dash-btn ${maxColumns === n ? "dash-btn--primary" : "dash-btn--outline"}`}
                onClick={() => setMaxColumns(n)}
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

      <TrashZone />

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

function TrashZone() {
  const { ref, isActive, isOver } = useTrashZone();
  if (!isActive) return null;
  return (
    <div
      ref={ref}
      className={`dash-trash-zone${isOver ? " dash-trash-zone--over" : ""}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
      {isOver ? "Release to remove" : "Drag here to remove"}
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

function saveState(widgets: WidgetState[], maxColumns: number, gap: number) {
  try {
    const serialized = serializeDashboard({ widgets, maxColumns, gap, containerWidth: 0 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {  }
}

function UncontrolledApp({ saved }: { saved: { widgets: WidgetState[]; maxColumns: number } | undefined }) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback((state: DashboardState) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState(state.widgets, state.maxColumns, state.gap);
    }, 300);
  }, []);

  return (
    <DashboardProvider
      definitions={definitions}
      initialWidgets={saved?.widgets ?? initialWidgets}
      maxColumns={saved?.maxColumns ?? 2}
      gap={16}
      dragConfig={DRAG_CONFIG}
      enableExternalDrag
      onChange={handleChange}
    >
      <DashboardContent />
    </DashboardProvider>
  );
}

function ControlledApp({ saved }: { saved: { widgets: WidgetState[]; maxColumns: number } | undefined }) {
  const [widgets, setWidgets] = useState<WidgetState[]>(saved?.widgets ?? initialWidgets);
  const [maxColumns, setMaxColumns] = useState(saved?.maxColumns ?? 2);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState(widgets, maxColumns, 16);
    }, 300);
  }, [widgets, maxColumns]);

  return (
    <DashboardProvider
      definitions={definitions}
      state={widgets}
      onStateChange={setWidgets}
      maxColumns={maxColumns}
      gap={16}
      dragConfig={DRAG_CONFIG}
      enableExternalDrag
    >
      <DashboardContent
        maxColumns={maxColumns}
        onMaxColumnsChange={setMaxColumns}
      />
    </DashboardProvider>
  );
}

export default function App() {
  const [mode, setMode] = useState<"uncontrolled" | "controlled">("uncontrolled");
  const [saved] = useState(() => loadSavedState());

  return (
    <>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 24px",
        background: mode === "controlled" ? "#fef3c7" : "#ecfdf5",
        borderBottom: `1px solid ${mode === "controlled" ? "#fcd34d" : "#6ee7b7"}`,
        fontSize: "0.8125rem",
        fontWeight: 550,
      }}>
        <span style={{ color: mode === "controlled" ? "#92400e" : "#065f46" }}>
          Mode: {mode === "controlled" ? "Controlled" : "Uncontrolled"}
        </span>
        <button
          className="dash-btn dash-btn--outline"
          style={{ padding: "3px 10px", fontSize: "0.75rem" }}
          onClick={() => setMode((m) => m === "uncontrolled" ? "controlled" : "uncontrolled")}
        >
          Switch to {mode === "uncontrolled" ? "Controlled" : "Uncontrolled"}
        </button>
        <span style={{ color: mode === "controlled" ? "#92400e" : "#065f46", opacity: 0.7 }}>
          {mode === "controlled"
            ? "Parent owns ALL state (widgets + columns + persistence). Provider is a pure render engine."
            : "Provider owns state internally. initialWidgets seeds on mount. onChange observes."}
        </span>
      </div>

      {mode === "uncontrolled"
        ? <UncontrolledApp key="uncontrolled" saved={saved} />
        : <ControlledApp key="controlled" saved={saved} />
      }
    </>
  );
}
