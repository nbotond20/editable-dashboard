/**
 * Seeded random scenario generator for drag-and-drop tests.
 *
 * Generates randomized test scenarios with initial layouts and action
 * sequences. No expected grids — the runner records actual behavior
 * from the real engine as the source of truth.
 */

import { createHash } from "node:crypto";

// ─── PRNG (xorshift32) ────────────────────────────────────────────

function xorshift32(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

// ─── Types ─────────────────────────────────────────────────────────

export type ScenarioAction =
  | { do: "swap"; source: string; target: string }
  | { do: "autoResize"; source: string; target: string; side: "left" | "right" }
  | { do: "dragToEmpty"; source: string; direction: "left" | "right" }
  | { do: "dragToColumn"; source: string; col: number }
  | { do: "dragToColumnAt"; source: string; col: number; ref: string }
  | { do: "dragToEmptyCell"; source: string; col: number };

export type Grid = (string | null)[][];

export interface GeneratedWidget {
  id: string;
  type: string;
  colSpan: number;
  order: number;
  visible: boolean;
}

export interface GeneratedScenario {
  seed: number;
  name: string;
  maxColumns: number;
  layout: string[];
  widgets: GeneratedWidget[];
  actions: ScenarioAction[];
  hash: string;
}

export interface PersistedStep {
  action: ScenarioAction;
  expected: Grid;
  actual?: Grid;
}

export interface PersistedScenario extends Omit<GeneratedScenario, "actions"> {
  steps: PersistedStep[];
  initialGrid: Grid;
  widgetHeights: Record<string, number>;
  status: "unverified" | "pass" | "bug" | "bad-test";
  failedAtStep?: number;
  failureReason?: string;
  runDate: string;
}

// ─── Layout Notation ───────────────────────────────────────────────

const WIDGET_TYPES = ["stats", "chart", "notes", "calendar", "table"];
const LETTERS = "abcdefghij";

function widgetsToNotation(
  widgets: GeneratedWidget[],
  maxColumns: number,
): string[] {
  // Simple greedy bin-pack to produce notation (no engine dependency)
  const visible = [...widgets].sort((a, b) => a.order - b.order);
  const colHeights = new Array(maxColumns).fill(0);
  const placements: { id: string; col: number; row: number; span: number }[] = [];

  for (const w of visible) {
    const span = Math.min(w.colSpan, maxColumns);
    let bestCol = 0, bestH = Infinity;
    for (let c = 0; c <= maxColumns - span; c++) {
      const h = Math.max(...colHeights.slice(c, c + span));
      if (h < bestH) { bestH = h; bestCol = c; }
    }
    placements.push({ id: w.id, col: bestCol, row: bestH, span });
    for (let c = bestCol; c < bestCol + span; c++) colHeights[c] = bestH + 1;
  }

  const maxRow = placements.length ? Math.max(...placements.map(p => p.row)) : -1;
  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row = new Array(maxColumns).fill(null);
    for (const p of placements) {
      if (p.row !== r) continue;
      for (let c = p.col; c < p.col + p.span; c++) row[c] = p.id;
    }
    const tokens: string[] = [];
    let c = 0;
    while (c < maxColumns) {
      const id = row[c];
      if (!id) { tokens.push("x"); c++; continue; }
      let span = 1;
      while (c + span < maxColumns && row[c + span] === id) span++;
      for (let s = 0; s < span; s++) tokens.push(id.toUpperCase());
      c += span;
    }
    lines.push(tokens.join(" "));
  }
  return lines;
}

// ─── Action Generation ─────────────────────────────────────────────

function pickAction(
  rand: () => number,
  widgets: GeneratedWidget[],
  maxColumns: number,
): ScenarioAction | null {
  const ids = widgets.map(w => w.id);
  if (ids.length < 2) return null;

  const pick = () => ids[Math.floor(rand() * ids.length)];
  const pickTwo = () => {
    const a = pick();
    let b: string;
    do { b = pick(); } while (b === a);
    return [a, b] as const;
  };

  const roll = rand();
  let type: string;
  if (roll < 0.40) type = "swap";
  else if (roll < 0.65) type = "autoResize";
  else if (roll < 0.78) type = "dragToColumn";
  else if (roll < 0.86) type = "dragToEmptyCell";
  else if (roll < 0.93) type = "dragToEmpty";
  else type = "dragToColumnAt";

  switch (type) {
    case "swap": {
      const [s, t] = pickTwo();
      return { do: "swap", source: s, target: t };
    }
    case "autoResize": {
      if (maxColumns < 2) return null;
      const [s, t] = pickTwo();
      return { do: "autoResize", source: s, target: t, side: rand() < 0.5 ? "left" : "right" };
    }
    case "dragToColumn": {
      return { do: "dragToColumn", source: pick(), col: Math.floor(rand() * maxColumns) };
    }
    case "dragToEmptyCell": {
      return { do: "dragToEmptyCell", source: pick(), col: Math.floor(rand() * maxColumns) };
    }
    case "dragToEmpty": {
      return { do: "dragToEmpty", source: pick(), direction: rand() < 0.5 ? "left" : "right" };
    }
    case "dragToColumnAt": {
      const [s, ref] = pickTwo();
      return { do: "dragToColumnAt", source: s, col: Math.floor(rand() * maxColumns), ref };
    }
  }
  return null;
}

// ─── Scenario Generation ───────────────────────────────────────────

function generateWidgets(
  rand: () => number,
  maxColumns: number,
  count: number,
): GeneratedWidget[] {
  const widgets: GeneratedWidget[] = [];
  for (let i = 0; i < count; i++) {
    widgets.push({
      id: LETTERS[i],
      type: WIDGET_TYPES[i % WIDGET_TYPES.length],
      colSpan: Math.min(Math.floor(rand() * Math.min(maxColumns, 3)) + 1, maxColumns),
      order: i,
      visible: true,
    });
  }
  return widgets;
}

export function generateScenario(seed: number): GeneratedScenario {
  const rand = xorshift32(seed);
  const maxColumns = Math.floor(rand() * 3) + 2; // 2–4
  const widgetCount = Math.floor(rand() * 5) + 2; // 2–6
  const actionCount = Math.floor(rand() * 3) + 3; // 3–5

  const widgets = generateWidgets(rand, maxColumns, widgetCount);
  const layout = widgetsToNotation(widgets, maxColumns);
  const actions: ScenarioAction[] = [];

  for (let i = 0; i < actionCount; i++) {
    const action = pickAction(rand, widgets, maxColumns);
    if (action) actions.push(action);
  }

  // Fallback: ensure at least one action
  if (actions.length === 0 && widgets.length >= 2) {
    actions.push({ do: "swap", source: widgets[0].id, target: widgets[1].id });
  }

  return {
    seed,
    name: `rand-${seed}-${maxColumns}col-${widgetCount}w`,
    maxColumns,
    layout,
    widgets,
    actions,
    hash: computeHash({ maxColumns, layout, actions }),
  };
}

export function generateScenarios(masterSeed: number, count: number): GeneratedScenario[] {
  return Array.from({ length: count }, (_, i) => generateScenario(masterSeed + i));
}

// ─── Deduplication ─────────────────────────────────────────────────

function computeHash(data: { maxColumns: number; layout: string[]; actions: ScenarioAction[] }): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}

export function deduplicateScenarios(
  newScenarios: GeneratedScenario[],
  existingHashes: Set<string>,
): GeneratedScenario[] {
  const seen = new Set(existingHashes);
  return newScenarios.filter(s => {
    if (seen.has(s.hash)) return false;
    seen.add(s.hash);
    return true;
  });
}

// ─── Persistence ───────────────────────────────────────────────────

export interface SuiteFile {
  scenarios: PersistedScenario[];
}

export function loadSuite(json: string): SuiteFile {
  try { return JSON.parse(json) as SuiteFile; }
  catch { return { scenarios: [] }; }
}

export function saveRecordedScenario(
  scenario: GeneratedScenario,
  initialGrid: Grid,
  stepGrids: Grid[],
  widgetHeights: Record<string, number>,
): PersistedScenario {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { actions: _actions, ...rest } = scenario;
  return {
    ...rest,
    steps: scenario.actions.map((action, i) => ({
      action,
      expected: stepGrids[i],
      actual: stepGrids[i],
    })),
    initialGrid,
    widgetHeights,
    status: "unverified" as const,
    runDate: new Date().toISOString(),
  };
}
