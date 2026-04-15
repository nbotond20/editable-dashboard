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
    `- Scenario (${e.scenarioSummary.maxColumns}col, ${e.scenarioSummary.actionDo}): AI said confidence=${e.aiConfidence}, but human disagreed: "${e.humanComment}"`
  );
  return "\n## Past Mistakes (learn from these)\n\n" + lines.join("\n");
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

Evaluate whether each step's result is correct according to the rules and examples above. Your job is to be a STRICT CRITIC, not a friendly assistant. Approve only results you can fully justify. Reject anything that deviates.

### Mandatory step-by-step verification

For EACH step, perform ALL of these checks in order. Record the outcome of each check in \`reasoning\`. Do NOT skip any.

**Check A — Widget preservation**: list the set of widget IDs in \`Result\`. Is it exactly equal to the set in the grid before the step? If not, this step is WRONG.

**Check B — ColSpan preservation**: for each widget, compute its colSpan in Result (consecutive cells with that ID in one row). Compare with its colSpan in the before grid. If ANY widget's colSpan changed AND the action is not \`autoResize\` or \`empty-row-maximize\`, this step is WRONG.

**Check C — Bounds**: is every cell index within [0, maxColumns-1]? Is every widget's (startCol + colSpan) ≤ maxColumns? If not, WRONG.

**Check D — Contiguity**: for each widget, are its cells in a row consecutive (no gaps)? If not, WRONG.

**Check E — Compaction**: are there any fully-empty rows between two occupied rows? If yes, WRONG.

**Check F — No cell sharing**: does any cell contain two different widget IDs? (Impossible in this grid format, but verify anyway.)

**Check G — Operation semantics**: apply the specific rule for the action type:
- \`swap(x, y)\`: x and y must have exchanged positions. Other widgets' relative order must be preserved.
- \`autoResize(source, target, side)\`: source and target MUST be on the same row after. Source MUST be on the specified side of target. Combined span ≤ maxColumns.
- \`dragToColumn(source, col)\`: source must start at column \`col\` in the result.
- \`dragToColumnAt(source, col, ref)\`: source must be at column \`col\` in the same row as \`ref\`.
- \`dragToEmpty(source, direction)\`: source moved in the specified direction within its row. If no space exists, no-op is acceptable.
- \`dragToEmptyCell(source, col)\`: source appears at column \`col\` in a row below all prior widget rows (or in a previously-empty row).

If ANY operation semantic check fails, the step is WRONG.

**Check H — Example match**: does this result look similar to any of the verified examples above? If yes, increase confidence. If no similar example exists, confidence capped at 89.

### Confidence scale (hard rules)

- **95-100**: ALL checks A–H pass, AND the result matches a verified example pattern.
- **80-94**: ALL checks A–H pass, BUT no matching verified example (novel but legal outcome).
- **70-79**: ALL invariant checks (A–F) pass, operation check G is partially correct (e.g., right widgets on row but wrong side).
- **40-69**: Invariants pass, but operation semantics (Check G) clearly violated.
- **20-39**: One invariant (A–F) violated OR operation clearly contradicts the rule.
- **0-19**: Multiple invariants violated OR the result makes no sense.

### Strict rules (violating these is automatic error)

1. "Seems plausible" is NOT sufficient for high confidence. You must prove which rule applies and verify ALL checks.
2. A no-op (grid unchanged) is ONLY acceptable when the action is literally impossible (e.g., \`dragToEmpty\` with no empty space). Otherwise, unchanged grid = WRONG.
3. If the action says \`side: "right"\` and the source ends up LEFT of target, confidence ≤ 30 — this is a real bug.
4. If a widget not involved in the action moved or resized without necessity, reduce confidence by 20.
5. NEVER say "this is probably correct" or "might be correct". Either prove it's correct or flag it as suspicious.

### When to propose a layout

Propose a layout in \`proposedLayouts\` ONLY IF ALL these hold:
- confidence < 70
- the step index is in \`suspiciousSteps\`
- you can construct the correct layout that passes ALL checks A–H
- your proposed layout is DIFFERENT from the engine's result

**CRITICAL**: NEVER propose a layout that is identical (cell-by-cell) to the engine's \`Result\`. If your proposed correct layout matches the engine's result, that means the engine was actually correct — set confidence ≥ 70, leave \`suspiciousSteps\` empty, and \`proposedLayouts\` empty.

Do NOT propose if you are uncertain what the correct answer should be — leave it for humans.

### Mandatory self-consistency (before responding)

- \`suspiciousSteps\` non-empty ⇒ \`confidence\` MUST be < 70.
- \`confidence\` ≥ 70 ⇒ \`suspiciousSteps\` MUST be empty AND \`proposedLayouts\` MUST be {}.
- Every key in \`proposedLayouts\` MUST appear in \`suspiciousSteps\`.
- Every proposed grid MUST satisfy ALL checks A–F.
- Reasoning MUST explicitly mention outcomes of checks A, B, C, D, E, G. Missing any of these = malformed response.

### Response format

Respond with ONLY a raw JSON object. No markdown, no code fences, no prose outside the JSON:

{
  "confidence": <0-100 integer>,
  "reasoning": "<numbered list of check outcomes, e.g. 'A: pass. B: pass (colSpans preserved). C: pass. D: pass. E: pass. G: swap(a,d) — a and d exchanged, others preserved: pass. Matches example X.'>",
  "suspiciousSteps": [<step indices>],
  "proposedLayouts": {
    "<step index>": [["widget_id", null, ...], ...]
  }
}

Grids in \`proposedLayouts\` use lowercase widget IDs, \`null\` for empty cells, every row padded to exactly \`maxColumns\` entries.
`);

  return sections.join("\n");
}
