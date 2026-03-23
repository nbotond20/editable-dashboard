import { useCallback, useEffect, useRef, useState } from "react";

export function useMeasureCache() {
  const [heights, setHeights] = useState<Map<string, number>>(
    () => new Map()
  );
  const observerRef = useRef<ResizeObserver | null>(null);
  const nodesRef = useRef<Map<string, HTMLElement>>(new Map());
  const idByElement = useRef<Map<HTMLElement, string>>(new Map());

  const pendingUpdates = useRef<Map<string, number>>(new Map());
  const rafId = useRef<number>(0);

  useEffect(() => {
    observerRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const id = idByElement.current.get(el);
        if (!id) continue;

        const height = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
        pendingUpdates.current.set(id, height);
      }

      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        if (pendingUpdates.current.size === 0) return;
        const updates = new Map(pendingUpdates.current);
        pendingUpdates.current.clear();

        setHeights((prev) => {
          let changed = false;
          const next = new Map(prev);
          for (const [id, h] of updates) {
            if (prev.get(id) !== h) {
              next.set(id, h);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      });
    });

    return () => {
      observerRef.current?.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  const measureRef = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      const observer = observerRef.current;
      if (!observer) return;

      const prev = nodesRef.current.get(id);
      if (prev) {
        observer.unobserve(prev);
        idByElement.current.delete(prev);
      }

      if (node) {
        nodesRef.current.set(id, node);
        idByElement.current.set(node, id);
        observer.observe(node);
      } else {
        nodesRef.current.delete(id);
      }
    },
    []
  );

  return { heights, measureRef };
}
