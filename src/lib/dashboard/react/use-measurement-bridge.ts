import { useEffect, useRef, useCallback } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";
import { useMeasureCache } from "./use-measure-cache.ts";

const NOOP_MEASURE = () => {};

/**
 * Bridges DOM measurement to the engine.
 *
 * When `controlledHeights` is provided, the consumer owns widget heights: those
 * heights are fed to the engine and internal ResizeObserver height measurement
 * is skipped (`measureRef` becomes a no-op). Container-width measurement stays
 * active regardless. This lets a consumer supply natural (un-stretched) heights
 * while rendering the engine's computed (e.g. equalized) heights, without the
 * self-measurement feeding rendered heights back into the layout.
 */
export function useMeasurementBridge(
  engine: DragEngine,
  controlledHeights?: ReadonlyMap<string, number>,
) {
  const { heights: measuredHeights, measureRef: measuredMeasureRef } = useMeasureCache();
  const isControlled = controlledHeights != null;
  const heights = isControlled ? controlledHeights : measuredHeights;
  const noopMeasureRef = useCallback(() => NOOP_MEASURE, []);
  const measureRef = isControlled ? noopMeasureRef : measuredMeasureRef;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const engineRef = useRef(engine);
  useEffect(() => { engineRef.current = engine; }, [engine]);

  useEffect(() => {
    engineRef.current.send({ type: "SET_HEIGHTS", heights });
  }, [heights]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    containerRef.current = node;

    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width =
            entry.contentBoxSize?.[0]?.inlineSize ?? node.clientWidth;
          engineRef.current.send({ type: "SET_CONTAINER", width });
        }
      });
      observer.observe(node);
      observerRef.current = observer;

      engineRef.current.send({
        type: "SET_CONTAINER",
        width: node.clientWidth,
      });
    }
  }, []);

  return { measureRef, containerRef, containerCallbackRef };
}
