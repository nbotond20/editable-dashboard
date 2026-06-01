import { motion } from "motion/react";
import type { InsertionLine, InsertionLineSegment } from "../../lib/dashboard/index.ts";

const LINE_COLOR = "#5b8def";
const INVALID_COLOR = "#e5484d";

/**
 * Circle + plus marker rendered at the far end of the active insertion line.
 * Positioned in container coordinates (its parent is the grid container).
 */
export function LineEndCap({ line }: { line: InsertionLine }) {
  if (!line.isActive || line.disabled) return null;
  const isVertical = line.orientation === "vertical";
  const cx = isVertical ? line.x1 : line.x2;
  const cy = isVertical ? line.y2 : line.y1;
  return (
    <motion.div
      data-testid="insertion-line-endcap"
      data-line-id={line.id}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0 } }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        translate: "-50% -50%",
        width: 22,
        height: 22,
        pointerEvents: "none",
        zIndex: 41,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill={LINE_COLOR} />
        <path d="M12 7v10M7 12h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}

interface AnchoredSegmentProps {
  segment: InsertionLineSegment;
  line: InsertionLine;
  widgetX: number;
  widgetY: number;
}

export function AnchoredInsertionSegment({ segment, line, widgetX, widgetY }: AnchoredSegmentProps) {
  const thickness = line.isActive || line.invalidActive ? 4 : 2;
  const color = line.invalidActive
    ? INVALID_COLOR
    : line.disabled ? "rgba(140,140,140,0.35)" : line.isActive ? LINE_COLOR : "rgba(91,141,239,0.5)";
  const opacity = line.invalidActive ? 1 : line.disabled ? 0.35 : 1;

  const isHorizontal = segment.edge === "top" || segment.edge === "bottom";
  const localX = segment.x1 - widgetX;
  const localY = segment.y1 - widgetY;

  const style: React.CSSProperties = isHorizontal
    ? {
        position: "absolute",
        left: localX,
        top: localY - thickness / 2,
        width: segment.x2 - segment.x1,
        height: thickness,
        backgroundColor: color,
        borderRadius: thickness,
        pointerEvents: "none",
        zIndex: 100,
      }
    : {
        position: "absolute",
        left: localX - thickness / 2,
        top: localY,
        width: thickness,
        height: segment.y2 - segment.y1,
        backgroundColor: color,
        borderRadius: thickness,
        pointerEvents: "none",
        zIndex: 100,
      };

  return (
    <motion.div
      data-testid="insertion-line-segment"
      data-line-id={line.id}
      data-line-orientation={line.orientation}
      data-line-active={line.isActive ? "true" : "false"}
      data-line-disabled={line.disabled ? "true" : "false"}
      data-line-invalid={line.invalidActive ? "true" : "false"}
      data-line-insertion-index={line.insertionIndex}
      data-line-anchor-id={segment.anchorId ?? ""}
      data-line-edge={segment.edge ?? ""}
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: 0.15 }}
      style={style}
    />
  );
}

interface LineMarkerProps {
  line: InsertionLine;
}

export function InsertionLineMarker({ line }: LineMarkerProps) {
  return (
    <div
      data-testid="insertion-line"
      data-line-id={line.id}
      data-line-orientation={line.orientation}
      data-line-active={line.isActive ? "true" : "false"}
      data-line-disabled={line.disabled ? "true" : "false"}
      data-line-insertion-index={line.insertionIndex}
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none", opacity: 0 }}
    />
  );
}

interface UnanchoredLineProps {
  line: InsertionLine;
}

export function UnanchoredInsertionLine({ line }: UnanchoredLineProps) {
  const isVertical = line.orientation === "vertical";
  const thickness = line.isActive || line.invalidActive ? 4 : 2;
  const color = line.invalidActive
    ? INVALID_COLOR
    : line.disabled ? "rgba(140,140,140,0.35)" : line.isActive ? LINE_COLOR : "rgba(91,141,239,0.5)";
  const length = isVertical ? line.y2 - line.y1 : line.x2 - line.x1;

  return (
    <motion.div
      data-testid="insertion-line"
      data-line-id={line.id}
      data-line-orientation={line.orientation}
      data-line-active={line.isActive ? "true" : "false"}
      data-line-disabled={line.disabled ? "true" : "false"}
      data-line-invalid={line.invalidActive ? "true" : "false"}
      data-line-insertion-index={line.insertionIndex}
      data-line-anchor-id=""
      data-line-edge=""
      initial={{ opacity: 0 }}
      animate={{ opacity: line.invalidActive ? 1 : line.disabled ? 0.35 : 1 }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: 0.15 }}
      style={{
        position: "absolute",
        left: isVertical ? line.x1 - thickness / 2 : line.x1,
        top: isVertical ? line.y1 : line.y1 - thickness / 2,
        width: isVertical ? thickness : length,
        height: isVertical ? length : thickness,
        backgroundColor: color,
        borderRadius: thickness,
        pointerEvents: "none",
        zIndex: 40,
      }}
    />
  );
}
