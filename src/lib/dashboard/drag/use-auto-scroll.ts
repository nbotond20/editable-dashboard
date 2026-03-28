import { useEffect, useRef } from "react";
import {
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
} from "../constants.ts";

export function useAutoScroll(
  isDragging: boolean,
  getPointerPosition: () => { x: number; y: number } | null,
  edgeSize: number = AUTO_SCROLL_EDGE_SIZE,
  maxSpeed: number = AUTO_SCROLL_MAX_SPEED,
) {
  const rafRef = useRef<number>(0);
  const getPointerPositionRef = useRef(getPointerPosition);
  useEffect(() => { getPointerPositionRef.current = getPointerPosition; });

  useEffect(() => {
    if (!isDragging) return;

    const tick = () => {
      const pos = getPointerPositionRef.current();
      if (pos) {
        scrollViewport(pos, edgeSize, maxSpeed);
        scrollAncestors(pos, edgeSize, maxSpeed);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDragging, edgeSize, maxSpeed]);
}

function edgeDelta(
  pointer: number,
  viewportSize: number,
  edgeSize: number,
  maxSpeed: number
): number {
  if (pointer < edgeSize) {
    const ratio = 1 - pointer / edgeSize;
    return -Math.round(ratio * maxSpeed);
  }
  if (pointer > viewportSize - edgeSize) {
    const ratio = 1 - (viewportSize - pointer) / edgeSize;
    return Math.round(ratio * maxSpeed);
  }
  return 0;
}

function scrollViewport(pos: { x: number; y: number }, edgeSize: number, maxSpeed: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const dx = edgeDelta(pos.x, vw, edgeSize, maxSpeed);
  const dy = edgeDelta(pos.y, vh, edgeSize, maxSpeed);

  if (dx !== 0 || dy !== 0) {
    window.scrollBy(dx, dy);
  }
}

function scrollAncestors(pos: { x: number; y: number }, edgeSize: number, maxSpeed: number) {
  let el = document.elementFromPoint(pos.x, pos.y) as HTMLElement | null;

  while (el && el !== document.documentElement) {
    if (isScrollable(el)) {
      const rect = el.getBoundingClientRect();
      const localX = pos.x - rect.left;
      const localY = pos.y - rect.top;

      const dx = edgeDelta(localX, rect.width, edgeSize, maxSpeed);
      const dy = edgeDelta(localY, rect.height, edgeSize, maxSpeed);

      if (dx !== 0 || dy !== 0) {
        el.scrollBy(dx, dy);
      }
    }
    el = el.parentElement;
  }
}

function isScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;
  const scrollable =
    overflowY === "auto" ||
    overflowY === "scroll" ||
    overflowX === "auto" ||
    overflowX === "scroll";

  return (
    scrollable &&
    (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)
  );
}
