import { useEffect, useRef, useCallback } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";
import { useMeasureCache } from "../layout/measure-cache.ts";

export function useMeasurementBridge(engine: DragEngine) {
  const { heights, measureRef } = useMeasureCache();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const engineRef = useRef(engine);
  useEffect(() => { engineRef.current = engine; }, [engine]);

  // Forward heights to engine whenever they change
  useEffect(() => {
    engineRef.current.send({ type: "SET_HEIGHTS", heights });
  }, [heights]);

  // Watch container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width =
          entry.contentBoxSize?.[0]?.inlineSize ?? el.clientWidth;
        engineRef.current.send({
          type: "SET_CONTAINER",
          width,
        });
      }
    });

    observer.observe(el);

    // Initial measurement
    engineRef.current.send({
      type: "SET_CONTAINER",
      width: el.clientWidth,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;

    if (node) {
      engineRef.current.send({
        type: "SET_CONTAINER",
        width: node.clientWidth,
      });
    }
  }, []);

  return { measureRef, containerRef, containerCallbackRef };
}
