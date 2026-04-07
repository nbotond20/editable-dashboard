import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { UseWidgetSlotResult } from "./use-widget-slot.ts";

/** Configuration for the drop-settle animation. */
export interface SettleConfig {
  /** Duration in milliseconds. Default: `300`. */
  duration?: number;
  /** CSS easing string. Default: `"cubic-bezier(0.23, 1, 0.32, 1)"` (strong ease-out). */
  easing?: string;
}

export interface DragFollowOptions {
  /**
   * Drop-settle animation config. Uses the browser-native Web Animations API
   * (hardware-accelerated, runs off the main thread).
   *
   * - Omit or pass `{}` for sensible defaults (300ms, strong ease-out).
   * - Pass `false` to disable (widget snaps to its new position instantly).
   */
  settle?: SettleConfig | false;
}

export interface DragFollowResult {
  /**
   * Ref callback — attach to the widget's root DOM element.
   * Combines drag tracking with the library's height measurement.
   */
  ref: (node: HTMLElement | null) => void;
  /**
   * `true` while the widget is being dragged **or** the engine is in the
   * post-drop "dropping" phase. Use this to elevate `z-index` and disable
   * layout animations during the settle window.
   */
  isActive: boolean;
}

const DEFAULT_SETTLE_DURATION = 300;
const DEFAULT_SETTLE_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Handles 60 fps drag-follow and drop-settle for a widget slot.
 *
 * - **During drag**: a `requestAnimationFrame` loop reads `getDragPosition()`
 *   and sets `style.translate` on the element — no React re-renders involved.
 * - **On drop**: a WAAPI animation smoothly moves the widget from where the
 *   user released it to its final layout position.
 * - **Re-grab safe**: grabbing a widget mid-settle cancels the animation.
 *
 * Zero animation-library dependencies — only React hooks and the DOM.
 *
 * @example
 * ```tsx
 * function MyWidgetSlot({ widget }: { widget: WidgetState }) {
 *   const slot = useWidgetSlot(widget);
 *   const drag = useDragFollow(slot);
 *
 *   if (!slot.position) return null;
 *   return (
 *     <div
 *       ref={drag.ref}
 *       style={{
 *         position: "absolute",
 *         left: slot.position.x,
 *         top: slot.position.y,
 *         width: slot.position.width,
 *         zIndex: drag.isActive ? 50 : 1,
 *       }}
 *     >
 *       <button {...slot.dragHandleProps}>Drag</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Disable settle animation (static mode)
 * ```tsx
 * const drag = useDragFollow(slot, { settle: false });
 * ```
 *
 * @example Custom settle timing
 * ```tsx
 * const drag = useDragFollow(slot, {
 *   settle: { duration: 400, easing: "ease-out" },
 * });
 * ```
 */
export function useDragFollow(
  slot: UseWidgetSlotResult,
  options?: DragFollowOptions,
): DragFollowResult {
  const { position, isDragging, getDragPosition, measureRef, phase } = slot;

  const settleOpt = options?.settle;
  const settleEnabled = settleOpt !== false;
  const settleDuration =
    (typeof settleOpt === "object" ? settleOpt.duration : undefined) ??
    DEFAULT_SETTLE_DURATION;
  const settleEasing =
    (typeof settleOpt === "object" ? settleOpt.easing : undefined) ??
    DEFAULT_SETTLE_EASING;

  const elRef = useRef<HTMLElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafId = useRef(0);
  const positionRef = useRef(position);
  const wasDraggingRef = useRef(false);
  const prevPositionRef = useRef<{ x: number; y: number } | null>(null);
  const settleAnimRef = useRef<Animation | null>(null);

  useEffect(() => {
    positionRef.current = position;
  });

  useLayoutEffect(() => {
    cancelAnimationFrame(rafId.current);

    if (isDragging && !wasDraggingRef.current && position) {
      prevPositionRef.current = { x: position.x, y: position.y };
      if (settleAnimRef.current) {
        settleAnimRef.current.cancel();
        settleAnimRef.current = null;
      }
    }

    if (!isDragging && wasDraggingRef.current && elRef.current) {
      const el = elRef.current;
      const prev = prevPositionRef.current;
      const offset = offsetRef.current;

      if (prev && position && settleEnabled) {
        const dx = prev.x + offset.x - position.x;
        const dy = prev.y + offset.y - position.y;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.style.translate = `${dx}px ${dy}px`;
          const anim = el.animate(
            [
              { translate: `${dx}px ${dy}px` },
              { translate: "0px 0px" },
            ],
            {
              duration: settleDuration,
              easing: settleEasing,
              fill: "forwards",
            },
          );
          settleAnimRef.current = anim;
          anim.onfinish = () => {
            el.style.translate = "";
            anim.cancel();
            settleAnimRef.current = null;
          };
          anim.oncancel = () => {
            el.style.translate = "";
            settleAnimRef.current = null;
          };
        } else {
          el.style.translate = "";
        }
      } else {
        el.style.translate = "";
      }

      offsetRef.current = { x: 0, y: 0 };
      prevPositionRef.current = null;
    }

    if (isDragging) {
      const tick = () => {
        const dp = getDragPosition();
        const pos = positionRef.current;
        if (dp && pos && elRef.current) {
          offsetRef.current = { x: dp.x - pos.x, y: dp.y - pos.y };
          elRef.current.style.translate = `${offsetRef.current.x}px ${offsetRef.current.y}px`;
        }
        rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
    }

    wasDraggingRef.current = isDragging;
    return () => cancelAnimationFrame(rafId.current);
  }, [isDragging, getDragPosition, settleEnabled, settleDuration, settleEasing, position]);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      elRef.current = node;
      measureRef(node);
    },
    [measureRef],
  );

  const isActive = isDragging || phase === "dropping";

  return { ref, isActive };
}
