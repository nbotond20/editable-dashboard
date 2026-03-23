import { useCallback, useRef, useEffect, type ReactElement } from "react";
import { createElement } from "react";

const LIVE_REGION_ID = "dashboard-drag-live-region";

const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function useDragAnnouncements() {
  const messageRef = useRef("");
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const announce = useCallback((message: string) => {
    messageRef.current = message;
    const el = nodeRef.current;
    if (el) {
      // Clear then set to ensure screen readers re-announce identical messages
      el.textContent = "";
      requestAnimationFrame(() => {
        el.textContent = message;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      messageRef.current = "";
    };
  }, []);

  const LiveRegion: () => ReactElement = useCallback(
    () =>
      createElement("div", {
        id: LIVE_REGION_ID,
        ref: nodeRef,
        role: "status",
        "aria-live": "assertive",
        "aria-atomic": true,
        style: VISUALLY_HIDDEN_STYLE,
      }),
    []
  );

  return { announce, LiveRegion, liveRegionId: LIVE_REGION_ID };
}
