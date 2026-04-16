import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getParsedExamples, type ParsedExample } from "./test-parser";
import type { PersistedScenario, Grid } from "./scenario-generator";

const DIR = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(DIR, "rules.md");
const FEEDBACK_PATH = join(DIR, "feedback-log.json");

export interface FeedbackEntry {
  hash: string;
  aiConfidence: number;
  aiReasoning: string;
  humanVerdict: "disagree";
  humanComment: string;
  scenarioSummary: {
    layout: string[];
    maxColumns: number;
    actionDo: string;
  };
  timestamp: string;
}

function loadRules(): string {
  return readFileSync(RULES_PATH, "utf-8");
}

function loadFeedback(): FeedbackEntry[] {
  if (!existsSync(FEEDBACK_PATH)) return [];
  try {
    return JSON.parse(readFileSync(FEEDBACK_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function selectExamples(
  scenario: PersistedScenario,
  maxCount: number,
): ParsedExample[] {
  const allExamples = getParsedExamples();
  const actionTypes = new Set<string>(scenario.steps.map(s => s.action.do));

  const scored = allExamples.map(ex => {
    let score = 0;
    if (ex.maxColumns === scenario.maxColumns) score += 10;
    if (actionTypes.has(ex.action.do)) score += 5;
    const exWidgets = new Set(ex.layout.join(" ").replace(/x/g, "").trim().split(/\s+/)).size;
    const scenWidgets = scenario.widgets.length;
    if (Math.abs(exWidgets - scenWidgets) <= 1) score += 2;
    return { example: ex, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map(s => s.example);
}

function selectApprovedExamples(
  scenario: PersistedScenario,
  approvedScenarios: PersistedScenario[],
  maxCount: number,
): PersistedScenario[] {
  const actionTypes = new Set<string>(scenario.steps.map(s => s.action.do));

  const scored = approvedScenarios.map(s => {
    let score = 0;
    if (s.maxColumns === scenario.maxColumns) score += 10;
    for (const step of s.steps) {
      if (actionTypes.has(step.action.do)) score += 3;
    }
    return { scenario: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map(s => s.scenario);
}

function formatGrid(grid: Grid): string {
  return grid.map(row => row.map(c => c ?? ".").join(" ")).join("\n");
}

function formatExample(ex: ParsedExample): string {
  return [
    `Layout (${ex.maxColumns} columns): ${ex.layout.join(" | ")}`,
    `Action: ${JSON.stringify(ex.action)}`,
    `Expected result:`,
    formatGrid(ex.expected),
  ].join("\n");
}

function formatScenarioExample(s: PersistedScenario): string {
  const lines = [`Layout (${s.maxColumns} columns): ${s.layout.join(" | ")}`];
  lines.push(`Initial grid:\n${formatGrid(s.initialGrid)}`);
  for (let i = 0; i < s.steps.length; i++) {
    lines.push(`Step ${i}: ${JSON.stringify(s.steps[i].action)}`);
    lines.push(`Result:\n${formatGrid(s.steps[i].expected)}`);
  }
  return lines.join("\n");
}

function formatFeedback(entries: FeedbackEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.slice(-20).map(e =>
    `- Layout (${e.scenarioSummary.maxColumns}col), action ${e.scenarioSummary.actionDo}: AI gave confidence=${e.aiConfidence}. Human disagreed: "${e.humanComment}"`
  );
  return "\n## Past Mistakes (study these — your previous reasoning was wrong here)\n\nApply these corrections to your evaluation. Each entry is a real case where AI was overconfident in a wrong answer.\n\n" + lines.join("\n");
}

export function buildPrompt(
  scenario: PersistedScenario,
  approvedScenarios: PersistedScenario[],
): string {
  const rules = loadRules();
  const feedback = loadFeedback();
  const handWritten = selectExamples(scenario, 3);
  const approved = selectApprovedExamples(scenario, approvedScenarios, 2);

  const sections: string[] = [];

  sections.push(rules);

  if (handWritten.length > 0) {
    sections.push("## Verified Examples (gold standard, from hand-written tests)\n");
    for (const ex of handWritten) {
      sections.push(formatExample(ex) + "\n");
    }
  }

  if (approved.length > 0) {
    sections.push("## Approved Random Scenarios\n");
    for (const s of approved) {
      sections.push(formatScenarioExample(s) + "\n");
    }
  }

  sections.push(formatFeedback(feedback));

  sections.push("## Scenario to Evaluate\n");
  sections.push(formatScenarioExample(scenario));

  sections.push(`
## Your Task

You evaluate whether each step's engine result is correct. Apply the rules above. Use the principles to disambiguate edge cases.

### Per-step protocol

For EACH step, perform the following actions IN ORDER. Output one entry per step in the \`perStep\` array.

**1. Intent** — state in one line what the action asks the engine to do. Reference the operation rule by name.
   Example: "dragToColumn(b, col=1): place widget b at column 1 in row 1, preserving colSpan 1."

**2. Predict** — construct the predicted grid cell-by-cell by applying the rule to the BEFORE grid. Use exact widget IDs and \`null\` for empty. Pad every row to exactly \`maxColumns\` entries. If multiple valid outcomes exist OR you genuinely do not know which rule branch applies, set \`prediction: null\`.

**3. Differences** — compare engine result to your prediction cell-by-cell. List each differing cell as \`"row R col C: predicted X, engine Y"\`. If \`prediction\` is null, set \`differences: null\`. If they match perfectly, use \`[]\`.

**4. Invariants** — check engine result against the global invariants. Output one short string. Format: \`"all pass"\` or \`"fail: <invariant name>, <which widget>"\`.

**5. Confidence (0–100)** — independent score of how likely the ENGINE result is correct, given the rules and approved examples. NOT how confident you feel in your own prediction.
   - **90–100**: rules unambiguously dictate one outcome AND engine matches AND a verified example shows the same pattern.
   - **70–89**: rules dictate AND engine matches, no exact example match.
   - **40–69**: rules ambiguous OR engine partially matches (e.g., right widgets on row but wrong column).
   - **0–39**: engine clearly violates rules or invariants.

**6. Proposal** — set \`proposal\` to your predicted grid IF AND ONLY IF:
   - your \`prediction\` in step 2 was NOT null, AND
   - your prediction differs from the engine's grid (cell-by-cell).
   Otherwise set \`proposal: null\`.

   Confidence and proposal are INDEPENDENT. You can have low confidence in the engine result without proposing — that means "I do not know what is right either, leave for human review".

### Hard rules

- ALWAYS work from concrete grid data: exact cells, widget IDs, colSpans, positions, gaps. No vague reasoning.
- A no-op (engine grid unchanged) is CORRECT when the action's no-op cases apply (see rules.md). Recognize these — do not flag them as wrong.
- "Looks plausible" is not a justification. Cite the specific rule and check.
- Past Mistakes section above contains real cases where the AI was overconfident in a wrong answer. Apply those lessons.

### Response format

Respond with ONLY a raw JSON object. No markdown, no code fences, no prose outside the JSON:

{
  "perStep": [
    {
      "intent": "<one line>",
      "prediction": [["a", null, "b"], ...] | null,
      "differences": ["row 0 col 1: predicted b, engine null"] | null,
      "invariants": "all pass" | "fail: <name>, <widget>",
      "confidence": <0-100 integer>,
      "proposal": [["a", null, "b"], ...] | null
    }
  ]
}

Grids use lowercase widget IDs and \`null\` for empty cells. Every row padded to exactly \`maxColumns\` entries.
`);

  return sections.join("\n");
}
