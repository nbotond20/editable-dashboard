import type { PersistedScenario, Grid } from "./scenario-generator";

export interface InvariantResult {
  result: "pass" | "fail";
  errors: string[];
}

function extractWidgets(grid: Grid): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of grid) {
    const seen = new Set<string>();
    for (const cell of row) {
      if (cell && !seen.has(cell)) {
        seen.add(cell);
        counts.set(cell, (counts.get(cell) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function checkStep(
  before: Grid,
  after: Grid,
  stepIndex: number,
  maxColumns: number,
): string[] {
  const errors: string[] = [];

  const beforeWidgets = extractWidgets(before);
  const afterWidgets = extractWidgets(after);
  for (const [id, count] of beforeWidgets) {
    if (!afterWidgets.has(id)) {
      errors.push(`Step ${stepIndex}: widget "${id}" lost`);
    } else if (afterWidgets.get(id)! !== count) {
      errors.push(`Step ${stepIndex}: widget "${id}" row count changed (${count} -> ${afterWidgets.get(id)})`);
    }
  }
  for (const id of afterWidgets.keys()) {
    if (!beforeWidgets.has(id)) {
      errors.push(`Step ${stepIndex}: widget "${id}" appeared from nowhere`);
    }
  }

  for (let r = 0; r < after.length; r++) {
    if (after[r].length > maxColumns) {
      errors.push(`Step ${stepIndex}: row ${r} has ${after[r].length} columns, max is ${maxColumns}`);
    }
  }

  let lastOccupied = -1;
  for (let r = 0; r < after.length; r++) {
    const hasWidget = after[r].some(c => c !== null);
    if (hasWidget) {
      if (lastOccupied >= 0 && r - lastOccupied > 1) {
        errors.push(`Step ${stepIndex}: empty row gap between rows ${lastOccupied} and ${r}`);
      }
      lastOccupied = r;
    }
  }

  for (const row of after) {
    let c = 0;
    while (c < row.length) {
      const id = row[c];
      if (id) {
        let span = 1;
        while (c + span < row.length && row[c + span] === id) span++;
        if (c + span > maxColumns) {
          errors.push(`Step ${stepIndex}: widget "${id}" at col ${c} with span ${span} overflows ${maxColumns} columns`);
        }
        c += span;
      } else {
        c++;
      }
    }
  }

  for (let r = 0; r < after.length; r++) {
    const positions = new Map<string, number[]>();
    for (let c = 0; c < after[r].length; c++) {
      const id = after[r][c];
      if (id) {
        if (!positions.has(id)) positions.set(id, []);
        positions.get(id)!.push(c);
      }
    }
    for (const [id, cols] of positions) {
      for (let i = 1; i < cols.length; i++) {
        if (cols[i] !== cols[i - 1] + 1) {
          errors.push(`Step ${stepIndex}: widget "${id}" has non-contiguous cells in row ${r}`);
          break;
        }
      }
    }
  }

  return errors;
}

export function checkInvariants(scenario: PersistedScenario): InvariantResult {
  const errors: string[] = [];

  let currentGrid = scenario.initialGrid;
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const after = step.expected;
    if (!after) continue;
    errors.push(...checkStep(currentGrid, after, i, scenario.maxColumns));
    currentGrid = after;
  }

  return {
    result: errors.length === 0 ? "pass" : "fail",
    errors,
  };
}
