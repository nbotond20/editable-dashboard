import { useEffect, useRef, useCallback } from "react";
import type { DragEngine } from "../engine/drag-engine.ts";
import { useMeasureCache } from "../layout/measure-cache.ts";

export function useMeasurementBridge(engine: DragEngine) {
  const { heights, measureRef } = useMeasureCache();
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
