import { useMemo, useCallback, useEffect, useRef } from "react";
import type { DashboardState, ComputedLayout } from "../types.ts";
import { computeLayout } from "./compute-layout.ts";
import { useMeasureCache } from "./measure-cache.ts";

export function useLayoutEngine(
  state: DashboardState,
  onContainerWidth: (width: number) => void
) {
  const { heights, measureRef } = useMeasureCache();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width =
        entry.contentBoxSize?.[0]?.inlineSize ?? el.clientWidth;
      onContainerWidth(width);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [onContainerWidth]);

  const layout: ComputedLayout = useMemo(
    () =>
      computeLayout(
        state.widgets,
        heights,
        state.containerWidth,
        state.maxColumns,
        state.gap
      ),
    [state.widgets, heights, state.containerWidth, state.maxColumns, state.gap]
  );

  const computePreviewLayout = useCallback(
    (tentativeWidgets: typeof state.widgets) =>
      computeLayout(
        tentativeWidgets,
        heights,
        state.containerWidth,
        state.maxColumns,
        state.gap
      ),
    [state, heights]
  );

  return { layout, containerRef, measureRef, computePreviewLayout };
}
