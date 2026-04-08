import { test, expect } from "@playwright/test";
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
  preview?: Grid;
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
  preview?: Grid;
  expected?: Grid;
  steps?: ScenarioStep[];
}

interface ScenarioGroup {
  group: string;
  layout?: string[];
  maxColumns?: number;
  scenarios: Scenario[];
}

async function executeAction(page: Page, action: ScenarioAction): Promise<(string | null)[][] | null> {
  switch (action.do) {
    case "swap":
      return dragByIdToId(page, action.source, action.target, { dwellMs: action.dwellMs });
    case "autoResize":
      return dragByIdToSide(page, action.source, action.target, action.side, { dwellMs: action.dwellMs });
    case "dragToEmpty":
      return dragByIdToAdjacentEmpty(page, action.source, action.direction, { side: action.side });
    case "dragToColumn":
      return dragByIdToColumn(page, action.source, action.col);
    case "dragToColumnAt":
      return dragByIdToColumnAtWidget(page, action.source, action.col, action.ref);
    case "dragToEmptyCell":
      return dragByIdToEmptyCell(page, action.source, action.col, { dwellMs: action.dwellMs });
    case "blockedDrag":
      await attemptBlockedDragByIdToId(page, action.source, action.target);
      return null;
    case "touchSwap":
      return touchDragByIdToId(page, action.source, action.target);
    case "touchResize":
      return touchDragByIdToSide(page, action.source, action.target, action.side);
    case "touchCancel":
      await touchDragCancelById(page, action.source, action.distance);
      return null;
  }
}

async function assertPreviewGrid(
  page: Page,
  captured: (string | null)[][] | null,
  expected: Grid,
) {
  expect(
    captured,
    "Ghost preview must be captured during drag",
  ).not.toBeNull();

  const maxColumns = await page.$eval(
    '[data-testid="dashboard-grid"]',
    (el) => Number((el as HTMLElement).dataset.maxColumns),
  );

  const padded = expected.map((row) => {
    const r = [...row];
    while (r.length < maxColumns) r.push(null);
    return r;
  });

  expect(
    captured!.length,
    `Preview: expected ${padded.length} rows, got ${captured!.length}.\n` +
    `Captured: ${JSON.stringify(captured)}\n` +
    `Expected: ${JSON.stringify(padded)}`,
  ).toBe(padded.length);

  for (let r = 0; r < padded.length; r++) {
    expect(
      captured![r],
      `Preview row ${r} mismatch.\n` +
      `Captured: ${JSON.stringify(captured)}\n` +
      `Expected: ${JSON.stringify(padded)}`,
    ).toEqual(padded[r]);
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
              const previewGrid = await executeAction(page, step.action);
              if (step.preview) {
                await assertPreviewGrid(page, previewGrid, step.preview);
              }
              if (step.expected) {
                await assertLayout(page, step.expected);
              }
            }
          } else if (s.action) {
            const previewGrid = await executeAction(page, s.action);
            if (s.preview) {
              await assertPreviewGrid(page, previewGrid, s.preview);
            }
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
