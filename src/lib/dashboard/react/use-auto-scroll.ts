import { useEffect, useRef } from "react";
import {
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
  AUTO_SCROLL_MIN_SPEED,
  SCROLL_INTERACTION_LOCK_MS,
} from "../constants.ts";

type Point = { x: number; y: number };
type Axis = "x" | "y";

export function useAutoScroll(
  isActive: boolean,
  getPointerPosition: () => Point | null,
  edgeSize: number = AUTO_SCROLL_EDGE_SIZE,
  maxSpeed: number = AUTO_SCROLL_MAX_SPEED,
  onScrollingChange?: (isScrolling: boolean) => void,
  getContainer?: () => HTMLElement | null,
) {
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accXRef = useRef<number>(0);
  const accYRef = useRef<number>(0);
  const scrollingRef = useRef<boolean>(false);
  const lastScrollTimeRef = useRef<number>(0);

  const getPointerPositionRef = useRef(getPointerPosition);
  const getContainerRef = useRef(getContainer);
  const onScrollingChangeRef = useRef(onScrollingChange);
  useEffect(() => {
    getPointerPositionRef.current = getPointerPosition;
    getContainerRef.current = getContainer;
    onScrollingChangeRef.current = onScrollingChange;
  });

  useEffect(() => {
    if (!isActive) return;

    const setScrolling = (value: boolean) => {
      if (scrollingRef.current === value) return;
      scrollingRef.current = value;
      onScrollingChangeRef.current?.(value);
    };

    const tick = (now: number) => {
      const last = lastTimeRef.current || now;
      // Clamp dt so a throttled/background frame can't produce a huge jump.
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      lastTimeRef.current = now;

      const pos = getPointerPositionRef.current();
      let scrolled = false;

      if (pos && dt > 0) {
        const container = getContainerRef.current?.() ?? null;

        const vx = axisSpeed(pos.x, window.innerWidth, edgeSize, maxSpeed);
        const vy = axisSpeed(pos.y, window.innerHeight, edgeSize, maxSpeed);

        accXRef.current += vx * dt;
        accYRef.current += vy * dt;

        const dx = Math.trunc(accXRef.current);
        const dy = Math.trunc(accYRef.current);

        if (dx !== 0) {
          const applied = applyScroll(pos, "x", dx, container);
          accXRef.current -= dx;
          if (applied !== 0) scrolled = true;
        }
        if (dy !== 0) {
          const applied = applyScroll(pos, "y", dy, container);
          accYRef.current -= dy;
          if (applied !== 0) scrolled = true;
        }
      }

      if (scrolled) {
        lastScrollTimeRef.current = now;
        setScrolling(true);
      } else if (
        scrollingRef.current &&
        now - lastScrollTimeRef.current >= SCROLL_INTERACTION_LOCK_MS
      ) {
        setScrolling(false);
        accXRef.current = 0;
        accYRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
      accXRef.current = 0;
      accYRef.current = 0;
      lastScrollTimeRef.current = 0;
      if (scrollingRef.current) {
        scrollingRef.current = false;
        onScrollingChangeRef.current?.(false);
      }
    };
  }, [isActive, edgeSize, maxSpeed]);
}

/** Signed target speed (px/sec) for one axis based on distance to the viewport edge. */
function axisSpeed(pointer: number, viewportSize: number, edgeSize: number, maxSpeed: number): number {
  if (edgeSize <= 0) return 0;
  if (pointer < edgeSize) {
    const ratio = clamp01((edgeSize - pointer) / edgeSize);
    return -speedForRatio(ratio, maxSpeed);
  }
  if (pointer > viewportSize - edgeSize) {
    const ratio = clamp01((pointer - (viewportSize - edgeSize)) / edgeSize);
    return speedForRatio(ratio, maxSpeed);
  }
  return 0;
}

/** Ease-in ramp from a perceptible minimum at the zone boundary up to maxSpeed at the edge. */
function speedForRatio(ratio: number, maxSpeed: number): number {
  const eased = ratio * ratio;
  return AUTO_SCROLL_MIN_SPEED + eased * (maxSpeed - AUTO_SCROLL_MIN_SPEED);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}


function applyScroll(pos: Point, axis: Axis, delta: number, container: HTMLElement | null): number {
  const scrollers = collectScrollers(pos, axis, delta, container);

  for (const scroller of scrollers) {
    if (scroller === window) {
      const before = axis === "x" ? window.scrollX : window.scrollY;
      window.scrollBy(axis === "x" ? delta : 0, axis === "y" ? delta : 0);
      const after = axis === "x" ? window.scrollX : window.scrollY;
      if (after !== before) return after - before;
    } else {
      const el = scroller as HTMLElement;
      const before = axis === "x" ? el.scrollLeft : el.scrollTop;
      if (axis === "x") el.scrollLeft += delta;
      else el.scrollTop += delta;
      const after = axis === "x" ? el.scrollLeft : el.scrollTop;
      if (after !== before) return after - before;
    }
  }

  return 0;
}

function collectScrollers(
  pos: Point,
  axis: Axis,
  delta: number,
  container: HTMLElement | null,
): (HTMLElement | Window)[] {
  const result: (HTMLElement | Window)[] = [];
  const seen = new Set<Element>();

  const walkUp = (start: Element | null) => {
    let el: HTMLElement | null = start as HTMLElement | null;
    while (el && el !== document.body && el !== document.documentElement) {
      if (!seen.has(el)) {
        seen.add(el);
        if (canScroll(el, axis, delta)) result.push(el);
      }
      el = el.parentElement;
    }
  };

  walkUp(document.elementFromPoint(pos.x, pos.y));
  if (container) walkUp(container);
  result.push(window);

  return result;
}

function canScroll(el: HTMLElement, axis: Axis, delta: number): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === "x" ? style.overflowX : style.overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;

  if (axis === "x") {
    if (el.scrollWidth <= el.clientWidth) return false;
    return delta < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  }
  if (el.scrollHeight <= el.clientHeight) return false;
  return delta < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}
