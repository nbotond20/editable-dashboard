import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkInvariants } from "./invariant-checker";
import { buildPrompt } from "./prompt-builder";
import { createProvider } from "./llm-provider";
import { loadSuite, type PersistedScenario, type SuiteFile } from "./scenario-generator";

const DIR = dirname(fileURLToPath(import.meta.url));
const SUITE_PATH = join(DIR, "suite", "scenarios.json");
const EVAL_TMP_DIR = join(DIR, "suite", ".eval-tmp");

function writeEvalTmp(scenario: PersistedScenario): void {
  if (!existsSync(EVAL_TMP_DIR)) mkdirSync(EVAL_TMP_DIR, { recursive: true });
  writeFileSync(join(EVAL_TMP_DIR, `${scenario.hash}.json`), JSON.stringify(scenario));
}

function mergeEvalTmp(suite: SuiteFile): number {
  if (!existsSync(EVAL_TMP_DIR)) return 0;
  const files = readdirSync(EVAL_TMP_DIR).filter(f => f.endsWith(".json"));
  let merged = 0;
  for (const file of files) {
    try {
      const scenario: PersistedScenario = JSON.parse(readFileSync(join(EVAL_TMP_DIR, file), "utf-8"));
      if (suite.scenarios[scenario.hash]) {
        suite.scenarios[scenario.hash] = scenario;
        merged++;
      }
    } catch {
      // Skip corrupted temp files
    }
  }
  return merged;
}

export async function evaluateScenarios(options?: {
  suitePath?: string;
  skipLlm?: boolean;
}): Promise<{ evaluated: number; invariantFailed: number; llmEvaluated: number }> {
  const path = options?.suitePath ?? SUITE_PATH;
  if (!existsSync(path)) {
    console.log("No scenarios.json found.");
    return { evaluated: 0, invariantFailed: 0, llmEvaluated: 0 };
  }

  const suite: SuiteFile = loadSuite(readFileSync(path, "utf-8"));

  // Merge any leftover temp files from a previous aborted run
  const recovered = mergeEvalTmp(suite);
  if (recovered > 0) {
    console.log(`Recovered ${recovered} scenario(s) from previous aborted run.`);
  }

  const allScenarios = Object.values(suite.scenarios);
  const approved = allScenarios.filter(s => s.status === "pass");
  const toEvaluate = allScenarios.filter(s =>
    s.status === "unverified" && (s.invariantResult === null || s.confidence === null)
  );

  if (toEvaluate.length === 0) {
    console.log("No unverified scenarios to evaluate.");
    if (recovered > 0) {
      writeFileSync(path, JSON.stringify(suite, null, 2) + "\n");
      rmSync(EVAL_TMP_DIR, { recursive: true, force: true });
    }
    return { evaluated: 0, invariantFailed: 0, llmEvaluated: 0 };
  }

  let invariantFailed = 0;
  let llmEvaluated = 0;
  const llmCandidates: PersistedScenario[] = [];

  // Pass 1: Invariant checks
  console.log(`Pass 1: Checking invariants for ${toEvaluate.length} scenarios...`);
  for (const scenario of toEvaluate) {
    const result = checkInvariants(scenario);
    scenario.invariantResult = result.result;
    scenario.invariantErrors = result.errors;
    if (result.result === "fail") {
      scenario.confidence = 0;
      scenario.aiReasoning = `Invariant check failed: ${result.errors.join("; ")}`;
      scenario.suspiciousSteps = [];
      invariantFailed++;
      writeEvalTmp(scenario);
    } else {
      llmCandidates.push(scenario);
    }
  }
  console.log(`  ${invariantFailed} failed invariants, ${llmCandidates.length} passed to LLM.`);

  // Pass 2: LLM evaluation
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  if (!options?.skipLlm && llmCandidates.length > 0 && hasApiKey) {
    console.log(`Pass 2: LLM evaluation for ${llmCandidates.length} scenarios...`);
    const provider = createProvider();

    for (let i = 0; i < llmCandidates.length; i++) {
      const scenario = llmCandidates[i];
      try {
        const prompt = buildPrompt(scenario, approved);
        const result = await provider.evaluate(prompt);

        const realProposals: Record<number, (string | null)[][]> = {};
        for (const [stepIdx, proposed] of Object.entries(result.proposedLayouts)) {
          const idx = Number(stepIdx);
          const step = scenario.steps[idx];
          if (!step) continue;
          if (JSON.stringify(proposed) === JSON.stringify(step.expected)) continue;
          realProposals[idx] = proposed;
        }

        scenario.confidence = result.confidence;
        scenario.aiReasoning = result.reasoning;
        scenario.suspiciousSteps = result.suspiciousSteps;
        scenario.perStep = result.perStep;

        for (const [stepIdx, proposed] of Object.entries(realProposals)) {
          const idx = Number(stepIdx);
          scenario.steps[idx].aiProposed = proposed;
        }
        llmEvaluated++;
        console.log(`  [${i + 1}/${llmCandidates.length}] ${scenario.name}: confidence=${result.confidence}`);
        writeEvalTmp(scenario);
      } catch (err) {
        console.error(`  [${i + 1}/${llmCandidates.length}] ${scenario.name}: LLM error — ${err}`);
        scenario.confidence = null;
        scenario.aiReasoning = `LLM evaluation failed: ${err}`;
        scenario.suspiciousSteps = [];
        scenario.perStep = undefined;
      }
      // Rate limit between calls
      if (i < llmCandidates.length - 1) await new Promise(r => setTimeout(r, 3000));
    }
  } else if (llmCandidates.length > 0 && !hasApiKey) {
    console.log("  Skipping LLM evaluation (GEMINI_API_KEY not set).");
  }

  // Final merge of any temp files (own run + any that weren't yet merged)
  mergeEvalTmp(suite);
  writeFileSync(path, JSON.stringify(suite, null, 2) + "\n");
  rmSync(EVAL_TMP_DIR, { recursive: true, force: true });
  console.log(`Done. Evaluated ${toEvaluate.length} scenarios.`);

  return { evaluated: toEvaluate.length, invariantFailed, llmEvaluated };
}
