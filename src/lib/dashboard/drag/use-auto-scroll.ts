import { useEffect, useRef } from "react";
import {
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
} from "../constants.ts";

export function useAutoScroll(
  isDragging: boolean,
  getPointerPosition: () => { x: number; y: number } | null
) {
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isDragging) return;

    const tick = () => {
      const pos = getPointerPosition();
      if (pos) {
        scrollViewport(pos);
        scrollAncestors(pos);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDragging, getPointerPosition]);
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

function scrollViewport(pos: { x: number; y: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const dx = edgeDelta(pos.x, vw, AUTO_SCROLL_EDGE_SIZE, AUTO_SCROLL_MAX_SPEED);
  const dy = edgeDelta(pos.y, vh, AUTO_SCROLL_EDGE_SIZE, AUTO_SCROLL_MAX_SPEED);

  if (dx !== 0 || dy !== 0) {
    window.scrollBy(dx, dy);
  }
}

function scrollAncestors(pos: { x: number; y: number }) {
  let el = document.elementFromPoint(pos.x, pos.y) as HTMLElement | null;

  while (el && el !== document.documentElement) {
    if (isScrollable(el)) {
      const rect = el.getBoundingClientRect();
      const localX = pos.x - rect.left;
      const localY = pos.y - rect.top;

      const dx = edgeDelta(localX, rect.width, AUTO_SCROLL_EDGE_SIZE, AUTO_SCROLL_MAX_SPEED);
      const dy = edgeDelta(localY, rect.height, AUTO_SCROLL_EDGE_SIZE, AUTO_SCROLL_MAX_SPEED);

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
