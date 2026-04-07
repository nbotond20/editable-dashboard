import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { WidgetDefinition } from "../lib/dashboard/index.ts";
import { useExternalDragSource } from "../lib/dashboard/index.ts";

interface WidgetCatalogProps {
  open: boolean;
  onClose: () => void;
  definitions: WidgetDefinition[];
  activeTypes: Set<string>;
  onAdd: (type: string) => void;
}

export function WidgetCatalog({
  open,
  onClose,
  definitions,
  activeTypes,
  onAdd,
}: WidgetCatalogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [hiddenForDrag, setHiddenForDrag] = useState(false);

  const onItemDragStart = useCallback(() => {
    requestAnimationFrame(() => setHiddenForDrag(true));
  }, []);
  const onItemDragEnd = useCallback(() => {
    requestAnimationFrame(() => setHiddenForDrag(false));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="dash-catalog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={hiddenForDrag ? { visibility: "hidden", pointerEvents: "none" } : undefined}
          />
          <motion.div
            ref={panelRef}
            className="dash-catalog-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            style={hiddenForDrag ? { visibility: "hidden", pointerEvents: "none" } : undefined}
          >
            <div className="dash-catalog-panel__header">
              <h2 className="dash-heading-sm">Add Widget</h2>
              <button
                className="dash-icon-btn"
                aria-label="Close"
                onClick={onClose}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="dash-catalog-panel__list">
              {definitions.map((def) => (
                <CatalogItem
                  key={def.type}
                  def={def}
                  isActive={activeTypes.has(def.type)}
                  onAdd={onAdd}
                  onItemDragStart={onItemDragStart}
                  onItemDragEnd={onItemDragEnd}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CatalogItem({
  def,
  isActive,
  onAdd,
  onItemDragStart,
  onItemDragEnd,
}: {
  def: WidgetDefinition;
  isActive: boolean;
  onAdd: (type: string) => void;
  onItemDragStart: () => void;
  onItemDragEnd: () => void;
}) {
  const dragProps = useExternalDragSource(def.type, {
    onDragStart: onItemDragStart,
    onDragEnd: onItemDragEnd,
  });

  return (
    <div className="dash-catalog-item" {...dragProps} style={{ cursor: "grab" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="dash-label-emphasis">{def.label}</span>
        <span className="dash-body-sm" style={{ color: "var(--dash-color-text-secondary)" }}>
          {def.defaultColSpan === 1 ? "Half width" : "Full width"} &middot; Drag to add
        </span>
      </div>
      <button
        className={`dash-btn ${isActive ? "dash-btn--secondary" : "dash-btn--primary"}`}
        onClick={() => onAdd(def.type)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        {isActive ? "Add Another" : "Add"}
      </button>
    </div>
  );
}
