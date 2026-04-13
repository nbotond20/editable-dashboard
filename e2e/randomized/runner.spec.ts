/**
 * Randomized drag test recorder.
 *
 * Generates random scenarios, runs each through the real app,
 * and records the actual grid at every step as the expected state.
 * All tests pass during recording — the recorded data becomes the
 * permanent regression suite.
 */

import { test } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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
import {
  generateScenarios,
  deduplicateScenarios,
  loadSuite,
  saveRecordedScenario,
  type ScenarioAction,
  type Grid,
} from "./scenario-generator";

// ─── Config ────────────────────────────────────────────────────────

const SCENARIO_COUNT = 50;
const SUITE_DIR = join(dirname(fileURLToPath(import.meta.url)), "suite");
const SUITE_PATH = join(SUITE_DIR, "scenarios.json");
const HASHES_PATH = join(SUITE_DIR, "hashes.json");
const TMP_DIR = join(SUITE_DIR, ".tmp");

// Seed: use RAND_SEED env var, or auto-derive from current timestamp
// so each run produces different scenarios.
const MASTER_SEED = Number(process.env.RAND_SEED) || (Date.now() % 1_000_000);

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

// ─── Generate & Deduplicate ────────────────────────────────────────

const scenarios = generateScenarios(MASTER_SEED, SCENARIO_COUNT);

let existingHashes = new Set<string>();
if (existsSync(HASHES_PATH)) {
  try { existingHashes = new Set(JSON.parse(readFileSync(HASHES_PATH, "utf-8"))); } catch { /* ignore */ }
} else if (existsSync(SUITE_PATH)) {
  existingHashes = new Set(Object.keys(loadSuite(readFileSync(SUITE_PATH, "utf-8")).scenarios));
}
const newScenarios = deduplicateScenarios(scenarios, existingHashes);

// ─── Record ────────────────────────────────────────────────────────

// Each test writes its result to a temp file so tests run in parallel.
mkdirSync(TMP_DIR, { recursive: true });

test.describe(`Record randomized tests (seed=${MASTER_SEED}, ${newScenarios.length} new / ${scenarios.length - newScenarios.length} skipped)`, () => {
  if (newScenarios.length === 0) {
    test("all scenarios already recorded", () => { test.skip(); });
    return;
  }

  for (const scenario of newScenarios) {
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

      const initialGrid = await getGridRepresentation(page);

      const widgetHeights: Record<string, number> = await page.$$eval(
        "[data-widget-id]",
        els => Object.fromEntries(els.map(el => [
          (el as HTMLElement).dataset.widgetId!,
          Number((el as HTMLElement).dataset.height) || 200,
        ])),
      );

      const stepGrids: Grid[] = [];

      for (const action of scenario.actions) {
        try {
          await executeAction(page, action);
        } catch {
          // Drag failed — record as no-op
        }
        stepGrids.push(await getGridRepresentation(page));
      }

      const persisted = saveRecordedScenario(scenario, initialGrid, stepGrids, widgetHeights);
      writeFileSync(join(TMP_DIR, `${scenario.hash}.json`), JSON.stringify(persisted));
    });
  }
});
