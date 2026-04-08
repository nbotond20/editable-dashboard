import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setupDashboard, setupDashboardRaw, type TestWidget } from "./setup";
import { assertLayout } from "./layout-utils";
import {
  dragByIdToId,
  dragByIdToSide,
  dragByIdToAdjacentEmpty,
  dragByIdToColumn,
  dragByIdToColumnAtWidget,
  dragByIdToEmptyCell,
  attemptBlockedDragByIdToId,
  touchDragByIdToId,
  touchDragByIdToSide,
  touchDragCancelById,
} from "./drag";

type Grid = (string | null)[][];

type ScenarioAction =
  | { do: "swap"; source: string; target: string; dwellMs?: number }
  | { do: "autoResize"; source: string; target: string; side: "left" | "right"; dwellMs?: number }
  | { do: "dragToEmpty"; source: string; direction: "left" | "right"; side?: "left" | "right" }
  | { do: "dragToColumn"; source: string; col: number }
  | { do: "dragToColumnAt"; source: string; col: number; ref: string }
  | { do: "dragToEmptyCell"; source: string; col: number; dwellMs?: number }
  | { do: "blockedDrag"; source: string; target: string }
  | { do: "touchSwap"; source: string; target: string }
  | { do: "touchResize"; source: string; target: string; side: "left" | "right" }
  | { do: "touchCancel"; source: string; distance: number };

interface ScenarioStep {
  action: ScenarioAction;
  expected?: Grid;
}

interface RawLayout {
  widgets: Omit<TestWidget, "order">[];
  maxColumns: number;
}

interface Scenario {
  name: string;
  layout?: string[];
  maxColumns?: number;
  rawLayout?: RawLayout;
  action?: ScenarioAction;
  expected?: Grid;
  steps?: ScenarioStep[];
}

interface ScenarioGroup {
  group: string;
  layout?: string[];
  maxColumns?: number;
  scenarios: Scenario[];
}

async function executeAction(page: Page, action: ScenarioAction): Promise<void> {
  switch (action.do) {
    case "swap":
      await dragByIdToId(page, action.source, action.target, { dwellMs: action.dwellMs });
      break;
    case "autoResize":
      await dragByIdToSide(page, action.source, action.target, action.side, { dwellMs: action.dwellMs });
      break;
    case "dragToEmpty":
      await dragByIdToAdjacentEmpty(page, action.source, action.direction, { side: action.side });
      break;
    case "dragToColumn":
      await dragByIdToColumn(page, action.source, action.col);
      break;
    case "dragToColumnAt":
      await dragByIdToColumnAtWidget(page, action.source, action.col, action.ref);
      break;
    case "dragToEmptyCell":
      await dragByIdToEmptyCell(page, action.source, action.col, { dwellMs: action.dwellMs });
      break;
    case "blockedDrag":
      await attemptBlockedDragByIdToId(page, action.source, action.target);
      break;
    case "touchSwap":
      await touchDragByIdToId(page, action.source, action.target);
      break;
    case "touchResize":
      await touchDragByIdToSide(page, action.source, action.target, action.side);
      break;
    case "touchCancel":
      await touchDragCancelById(page, action.source, action.distance);
      break;
  }
}

export function defineScenarios(groups: ScenarioGroup[]): void {
  for (const g of groups) {
    test.describe(g.group, () => {
      for (const s of g.scenarios) {
        test(s.name, async ({ page }) => {
          if (s.rawLayout) {
            const widgets = s.rawLayout.widgets.map((w, i) => ({ ...w, order: i }));
            await setupDashboardRaw(page, widgets, s.rawLayout.maxColumns);
          } else {
            const layout = s.layout ?? g.layout;
            if (!layout) throw new Error(`No layout for "${s.name}" in group "${g.group}"`);
            await setupDashboard(page, layout, s.maxColumns ?? g.maxColumns);
          }

          if (s.steps) {
            for (const step of s.steps) {
              await executeAction(page, step.action);
              if (step.expected) {
                await assertLayout(page, step.expected);
              }
            }
          } else if (s.action) {
            await executeAction(page, s.action);
            if (s.expected) {
              await assertLayout(page, s.expected);
            }
          }
        });
      }
    });
  }
}

export type { ScenarioAction, ScenarioStep, Scenario, ScenarioGroup, Grid, RawLayout };
