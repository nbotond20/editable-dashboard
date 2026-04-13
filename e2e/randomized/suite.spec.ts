/**
 * Permanent suite runner.
 *
 * Replays recorded scenarios from suite/scenarios.json and verifies
 * the engine still produces the same grids. Any mismatch = regression.
 */

import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setupDashboardRaw } from "../helpers/setup";
import { getGridRepresentation } from "../helpers/layout-utils";
import {
  dragByIdToId,
  dragByIdToSide,
  dragByIdToAdjacentEmpty,
  dragByIdToColumn,
  dragByIdToColumnAtWidget,
  dragByIdToEmptyCell,
} from "../helpers/drag";
import type { ScenarioAction, PersistedScenario, SuiteFile } from "./scenario-generator";

// ─── Load Suite ────────────────────────────────────────────────────

const SUITE_PATH = join(dirname(fileURLToPath(import.meta.url)), "suite", "scenarios.json");

let suiteScenarios: PersistedScenario[] = [];
if (existsSync(SUITE_PATH)) {
  try {
    const suite: SuiteFile = JSON.parse(readFileSync(SUITE_PATH, "utf-8"));
    suiteScenarios = Object.values(suite.scenarios);
  } catch { /* empty suite */ }
}

// ─── Action Executor ───────────────────────────────────────────────

async function executeAction(
  page: import("@playwright/test").Page,
  action: ScenarioAction,
): Promise<void> {
  switch (action.do) {
    case "swap":
      await dragByIdToId(page, action.source, action.target);
      break;
    case "autoResize":
      await dragByIdToSide(page, action.source, action.target, action.side);
      break;
    case "dragToEmpty":
      await dragByIdToAdjacentEmpty(page, action.source, action.direction);
      break;
    case "dragToColumn":
      await dragByIdToColumn(page, action.source, action.col);
      break;
    case "dragToColumnAt":
      await dragByIdToColumnAtWidget(page, action.source, action.col, action.ref);
      break;
    case "dragToEmptyCell":
      await dragByIdToEmptyCell(page, action.source, action.col);
      break;
  }
}

// ─── Tests ─────────────────────────────────────────────────────────

test.describe("Permanent randomized suite", () => {
  const verified = suiteScenarios.filter(s => s.status === "pass");

  if (verified.length === 0) {
    test("no verified scenarios in suite", () => { test.skip(); });
    return;
  }

  for (const scenario of verified) {
    test(scenario.name, async ({ page }) => {
      await setupDashboardRaw(
        page,
        scenario.widgets.map(w => ({
          id: w.id,
          colSpan: w.colSpan,
          order: w.order,
          type: w.type,
        })),
        scenario.maxColumns,
      );

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        try {
          await executeAction(page, step.action);
        } catch {
          // Drag failed (e.g. impossible drag) — compare grid as-is
        }
        const actual = await getGridRepresentation(page);

        const expected = step.expected.map(row => {
          const r = [...row];
          while (r.length < scenario.maxColumns) r.push(null);
          return r;
        });

        expect(
          actual,
          `Step ${i}: ${JSON.stringify(step.action)}\n` +
            `Expected: ${JSON.stringify(expected)}\n` +
            `Actual:   ${JSON.stringify(actual)}`,
        ).toEqual(expected);
      }
    });
  }
});
