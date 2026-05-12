import { useMemo } from "react";
import { useInsertionLines } from "./use-insertion-lines.ts";
import type { InsertionLine, InsertionLineSegment } from "../engine/types.ts";

export interface AnchoredInsertionSegment {
  line: InsertionLine;
  segment: InsertionLineSegment;
  index: number;
}

const EMPTY: AnchoredInsertionSegment[] = [];
const ANCHOR_MAP_CACHE = new WeakMap<
  readonly InsertionLine[],
  Map<string, AnchoredInsertionSegment[]>
>();

function buildAnchorMap(
  lines: readonly InsertionLine[],
): Map<string, AnchoredInsertionSegment[]> {
  const map = new Map<string, AnchoredInsertionSegment[]>();
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const segs = line.segments;
    if (!segs) continue;
    for (let si = 0; si < segs.length; si++) {
      const segment = segs[si];
      const anchorId = segment.anchorId;
      if (anchorId == null) continue;
      let bucket = map.get(anchorId);
      if (!bucket) {
        bucket = [];
        map.set(anchorId, bucket);
      }
      bucket.push({ line, segment, index: si });
    }
  }
  return map;
}

function getAnchorMap(
  lines: readonly InsertionLine[],
): Map<string, AnchoredInsertionSegment[]> {
  let map = ANCHOR_MAP_CACHE.get(lines);
  if (map) return map;
  map = buildAnchorMap(lines);
  ANCHOR_MAP_CACHE.set(lines, map);
  return map;
}

/**
 * Returns the insertion line segments anchored to the given widget id.
 *
 * The underlying anchor index is shared across widgets and cached by the
 * identity of the insertion-lines array, so each call is O(1) once the
 * map is built. Use this inside per-widget components instead of filtering
 * the full lines array to avoid O(widgets × lines × segments) work.
 */
export function useAnchoredInsertionSegments(
  widgetId: string,
): AnchoredInsertionSegment[] {
  const lines = useInsertionLines();
  return useMemo(() => {
    const map = getAnchorMap(lines);
    return map.get(widgetId) ?? EMPTY;
  }, [lines, widgetId]);
}
