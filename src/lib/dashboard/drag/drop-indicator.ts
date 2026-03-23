import type { ComputedLayout, WidgetState, DropTarget } from "../types.ts";

export function computeDropTarget(
  pointerX: number,
  pointerY: number,
  widgets: WidgetState[],
  maxColumns: number,
  draggedId: string,
  containerRect: DOMRect,
  tryLayout: (tentativeWidgets: WidgetState[]) => ComputedLayout,
  isLocked?: (id: string) => boolean
): DropTargetResult | null {
  const visible = widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  const draggedIndex = visible.findIndex((w) => w.id === draggedId);
  if (draggedIndex === -1) return null;

  const dragged = visible[draggedIndex];
  const others = visible.filter((w) => w.id !== draggedId);

  const relX = pointerX - containerRect.left;
  const relY =
    pointerY -
    containerRect.top +
    (document.documentElement.scrollTop || 0);

  interface Candidate {
    targetIndex: number;
    dist: number;
    affectedResizes: Array<{ id: string; colSpan: number }>;
    previewLayout: ComputedLayout;
    columnStart?: number;
    swapWithId?: string;
  }

  const candidates: Candidate[] = [];

  const currentLayout = tryLayout(
    visible.map((w, i) => ({ ...w, order: i }))
  );
  const draggedLayoutPos = currentLayout.positions.get(draggedId);
  const currentPos: { x: number; y: number } | null = draggedLayoutPos
    ? { x: draggedLayoutPos.x, y: draggedLayoutPos.y }
    : null;

  const tryCandidate = (
    targetIndex: number,
    tentativeWidgets: WidgetState[],
    affectedResizes: Array<{ id: string; colSpan: number }>,
    columnStart?: number
  ) => {
    const reordered = tentativeWidgets.map((w, i) => ({ ...w, order: i }));
    const previewLayout = tryLayout(reordered);
    const pos = previewLayout.positions.get(draggedId);
    if (!pos) return;

    const cx = pos.x + pos.width / 2;
    const cy = pos.y + pos.height / 2;
    const dist = Math.hypot(relX - cx, (relY - cy) * 1.5);

    candidates.push({ targetIndex, dist, affectedResizes, previewLayout, columnStart });
  };

  const draggedNoHint = { ...dragged, columnStart: undefined };
  const othersNoHint = others.map((w) =>
    w.columnStart != null ? { ...w, columnStart: undefined } : w
  );

  if (others.length > 0) {
    for (let i = 0; i <= othersNoHint.length; i++) {
      const widget = i === draggedIndex ? dragged : draggedNoHint;
      const tentative = [...othersNoHint];
      tentative.splice(i, 0, widget);
      tryCandidate(i, tentative, []);
    }
  }

  if (maxColumns > 1 && others.length > 0) {
    for (let i = 0; i < others.length; i++) {
      const peer = others[i];
      const combined = peer.colSpan + dragged.colSpan;

      if (combined <= maxColumns) continue;

      const peerSpan = Math.ceil(maxColumns / 2);
      const dragSpan = maxColumns - peerSpan;

      const resizes: Array<{ id: string; colSpan: number }> = [];
      if (peer.colSpan !== peerSpan)
        resizes.push({ id: peer.id, colSpan: peerSpan });
      if (dragged.colSpan !== dragSpan)
        resizes.push({ id: draggedId, colSpan: dragSpan });

      const peerNoHint = othersNoHint[i];
      const resizedPeer =
        peerSpan !== peerNoHint.colSpan
          ? { ...peerNoHint, colSpan: peerSpan }
          : peerNoHint;
      const resizedDragged =
        dragSpan !== dragged.colSpan
          ? { ...draggedNoHint, colSpan: dragSpan }
          : draggedNoHint;

      {
        const tentative = [...othersNoHint];
        tentative[i] = resizedPeer;
        tentative.splice(i, 0, resizedDragged);
        tryCandidate(i, tentative, resizes);
      }

      {
        const tentative = [...othersNoHint];
        tentative[i] = resizedPeer;
        tentative.splice(i + 1, 0, resizedDragged);
        tryCandidate(i + 1, tentative, resizes);
      }
    }
  }

  if (others.length > 0 && draggedLayoutPos) {
    const draggedRowY = Math.round(draggedLayoutPos.y);

    for (let i = 0; i < othersNoHint.length; i++) {
      const target = othersNoHint[i];
      const targetPos = currentLayout.positions.get(target.id);
      if (!targetPos) continue;

      if (Math.round(targetPos.y) === draggedRowY) continue;

      const tentative = [...othersNoHint];
      tentative[i] = draggedNoHint;
      tentative.splice(draggedIndex, 0, target);

      const reordered = tentative.map((w, idx) => ({ ...w, order: idx }));
      const previewLayout = tryLayout(reordered);
      const pos = previewLayout.positions.get(draggedId);
      if (!pos) continue;

      const cx = pos.x + pos.width / 2;
      const cy = pos.y + pos.height / 2;
      const dist = Math.hypot(relX - cx, (relY - cy) * 1.5);
      const targetIndex = tentative.findIndex((w) => w.id === draggedId);

      candidates.push({
        targetIndex,
        dist,
        affectedResizes: [],
        previewLayout,
        swapWithId: target.id,
      });
    }
  }

  const currentSpan = Math.max(1, Math.min(dragged.colSpan, maxColumns));

  if (maxColumns > 1 && others.length > 0) {
    const othersOrdered = othersNoHint.map((w, i) => ({ ...w, order: i }));
    const othersLayout = tryLayout(othersOrdered);

    const rowGroups = new Map<number, number[]>();
    for (let idx = 0; idx < othersNoHint.length; idx++) {
      const pos = othersLayout.positions.get(othersNoHint[idx].id);
      if (!pos) continue;
      const y = Math.round(pos.y);
      if (!rowGroups.has(y)) rowGroups.set(y, []);
      rowGroups.get(y)!.push(idx);
    }

    for (const rowIndices of rowGroups.values()) {
      const rowWidgets = rowIndices.map((i) => othersNoHint[i]);
      const rowTotalSpan = rowWidgets.reduce((s, w) => s + w.colSpan, 0);
      const newCount = rowWidgets.length + 1;

      if (rowTotalSpan + currentSpan <= maxColumns) continue;
      if (newCount > maxColumns) continue;
      if (rowWidgets.length <= 1) continue;

      const dragSpan = Math.min(currentSpan, maxColumns - rowWidgets.length);
      const remaining = maxColumns - dragSpan;
      if (remaining < rowWidgets.length) continue;

      const perWidget = Math.floor(remaining / rowWidgets.length);
      const extraCount = remaining % rowWidgets.length;

      const resizeMap = new Map<string, number>();
      rowWidgets.forEach((w, idx) => {
        const newSpan = perWidget + (idx < extraCount ? 1 : 0);
        if (w.colSpan !== newSpan) resizeMap.set(w.id, newSpan);
      });
      if (dragged.colSpan !== dragSpan) resizeMap.set(draggedId, dragSpan);

      if (resizeMap.size === 0) continue;

      const resizes = [...resizeMap.entries()].map(([id, colSpan]) => ({
        id,
        colSpan,
      }));
      const resizedOthers = othersNoHint.map((w) => {
        const s = resizeMap.get(w.id);
        return s != null ? { ...w, colSpan: s } : w;
      });
      const resizedDragged = { ...draggedNoHint, colSpan: dragSpan };

      const first = Math.min(...rowIndices);
      const last = Math.max(...rowIndices);
      for (let ins = first; ins <= last + 1; ins++) {
        const tentative = [...resizedOthers];
        tentative.splice(ins, 0, resizedDragged);
        tryCandidate(ins, tentative, resizes);
      }
    }
  }

  for (let col = 0; col <= maxColumns - currentSpan; col++) {
    const withHint = { ...dragged, columnStart: col };
    const tentative = [...others];
    tentative.splice(draggedIndex, 0, withHint);
    tryCandidate(draggedIndex, tentative, [], col);
  }

  // Filter out candidates involving locked widgets.
  const filtered = isLocked
    ? candidates.filter((c) => {
        // Reject swaps with a locked widget.
        if (c.swapWithId && isLocked(c.swapWithId)) return false;
        // Reject resizes that affect a locked widget (other than the dragged one).
        if (
          c.affectedResizes.some(
            (r) => r.id !== draggedId && isLocked(r.id)
          )
        )
          return false;
        return true;
      })
    : candidates;

  if (filtered.length === 0) return null;

  const best = filtered.reduce((a, b) => {
    if (a.dist < b.dist) return a;
    if (b.dist < a.dist) return b;
    if (a.swapWithId != null && b.swapWithId == null) return a;
    if (b.swapWithId != null && a.swapWithId == null) return b;
    return a;
  });

  if (
    best.targetIndex === draggedIndex &&
    best.affectedResizes.length === 0 &&
    best.columnStart == null
  )
    return null;

  if (
    best.targetIndex === draggedIndex &&
    best.affectedResizes.length === 0 &&
    best.columnStart != null &&
    currentPos
  ) {
    const pos = best.previewLayout.positions.get(draggedId);
    if (
      pos &&
      Math.round(pos.x) === Math.round(currentPos.x) &&
      Math.round(pos.y) === Math.round(currentPos.y)
    )
      return null;
  }

  return {
    dropTarget: {
      targetIndex: best.targetIndex,
      previewColSpan:
        best.affectedResizes.find((r) => r.id === draggedId)?.colSpan ?? null,
      affectedResizes: best.affectedResizes,
      columnStart: best.columnStart,
      swapWithId: best.swapWithId,
    },
    previewLayout: best.previewLayout,
  };
}

export interface DropTargetResult {
  dropTarget: DropTarget;
  previewLayout: ComputedLayout;
}
