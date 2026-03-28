/**
 * Generates a fluid, human-like mouse path between two points.
 *
 * Computes a smooth Bézier + sine-wobble path at ~5px spacing, ensuring the
 * cursor crosses every gap and widget boundary naturally — just like a real
 * human hand.  Output is capped at 150 points so the Playwright movement
 * loop stays fast enough for dwell-timer-sensitive drag operations.
 *
 * Deterministic: seeded PRNG keyed on start/end coordinates, so every
 * run produces the same path for the same inputs.
 */

export interface PathPoint {
  x: number;
  y: number;
  /** If set, the movement loop should pause for this many ms at this point. */
  pauseMs?: number;
}

// ── Seeded PRNG (xorshift32) ────────────────────────────────────────

function createRng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff; // 0..1
  };
}

function hashCoords(x1: number, y1: number, x2: number, y2: number): number {
  let h = 0x811c9dc5;
  for (const v of [x1, y1, x2, y2]) {
    h ^= Math.round(v * 100);
    h = Math.imul(h, 0x01000193);
  }
  return h;
}

// ── Helpers ─────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * @param steps — kept for API compatibility but ignored; point count is
 *   derived from pixel distance (~1 point per 2px).
 */
export function humanizePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): PathPoint[] {
  const rng = createRng(hashCoords(startX, startY, endX, endY));

  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // ~1 point per 5px, clamped to [15, 150].
  // 5px spacing crosses a 16px gap with ~3 points (no skipping) while keeping
  // the movement loop fast enough that dwell timers don't over-accumulate.
  const pointCount = Math.min(150, Math.max(15, Math.round(dist / 5)));

  // Very short drags — just interpolate linearly
  if (dist < 10) {
    const pts: PathPoint[] = [];
    for (let i = 1; i <= pointCount; i++) {
      pts.push({
        x: startX + dx * (i / pointCount),
        y: startY + dy * (i / pointCount),
      });
    }
    return pts;
  }

  // ── Perpendicular unit vector ─────────────────────────────────────
  const perpX = -dy / dist;
  const perpY = dx / dist;

  // ── Gentle Bézier arc — subtle curve, not aggressive ──────────────
  const curveFraction = 0.02 + rng() * 0.04; // 2–6% of travel distance
  const curveDist = dist * curveFraction * (rng() < 0.5 ? -1 : 1);
  const cpX = (startX + endX) / 2 + perpX * curveDist;
  const cpY = (startY + endY) / 2 + perpY * curveDist;

  // ── Smooth sine-sum wobble — bounded, no divergence ───────────────
  const wobbleAmplitude = Math.min(3, dist * 0.005);
  const freq1 = 5 + rng() * 3;       // 5–8 oscillations across path
  const freq2 = 11 + rng() * 5;      // 11–16 oscillations (higher freq)
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;

  // ── Micro-pauses — hesitations scattered through the path ─────────
  const pauseCount = 2 + Math.floor(rng() * 4); // 2–5 pauses
  const pauseIndices = new Set<number>();
  for (let p = 0; p < pauseCount; p++) {
    const idx = 2 + Math.floor(rng() * Math.floor(pointCount * 0.7));
    pauseIndices.add(idx);
  }

  // ── Approach distance: fixed 15px from target ─────────────────────
  const approachDist = 15;

  const points: PathPoint[] = [];

  for (let i = 1; i <= pointCount; i++) {
    const rawT = i / pointCount;
    const t = easeInOut(rawT);

    // Bézier backbone
    const bx = quadBezier(t, startX, cpX, endX);
    const by = quadBezier(t, startY, cpY, endY);

    // Distance from backbone point to target
    const remainX = endX - bx;
    const remainY = endY - by;
    const remainDist = Math.sqrt(remainX * remainX + remainY * remainY);

    let x: number;
    let y: number;

    if (remainDist <= approachDist) {
      // Approach phase: blend toward exact target, decay wobble
      const approachT = 1 - remainDist / approachDist; // 0→1 as we get closer
      x = lerp(bx, endX, approachT);
      y = lerp(by, endY, approachT);
    } else {
      // Smooth sine wobble perpendicular to path
      const wobbleT = rawT * Math.PI * 2;
      const wobble =
        wobbleAmplitude *
        (Math.sin(wobbleT * freq1 + phase1) * 0.6 +
         Math.sin(wobbleT * freq2 + phase2) * 0.4);

      x = bx + perpX * wobble;
      y = by + perpY * wobble;
    }

    // Final point is always exact
    if (i === pointCount) {
      x = endX;
      y = endY;
    }

    const pt: PathPoint = { x, y };

    if (pauseIndices.has(i)) {
      pt.pauseMs = 5 + Math.floor(rng() * 21); // 5–25 ms
    }

    points.push(pt);
  }

  return points;
}
