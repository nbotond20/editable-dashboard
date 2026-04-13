/**
 * Merges per-test temp files into the main scenarios.json and hashes.json.
 * Run after the recorder finishes: npx tsx e2e/randomized/merge-results.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSuite, type PersistedScenario, type SuiteFile } from "./scenario-generator";

const SUITE_DIR = join(dirname(fileURLToPath(import.meta.url)), "suite");
const SUITE_PATH = join(SUITE_DIR, "scenarios.json");
const HASHES_PATH = join(SUITE_DIR, "hashes.json");
const TMP_DIR = join(SUITE_DIR, ".tmp");

if (!existsSync(TMP_DIR)) {
  console.log("No temp files to merge.");
  process.exit(0);
}

const tmpFiles = readdirSync(TMP_DIR).filter(f => f.endsWith(".json"));
if (tmpFiles.length === 0) {
  console.log("No temp files to merge.");
  rmSync(TMP_DIR, { recursive: true });
  process.exit(0);
}

let suite: SuiteFile = { scenarios: {} };
if (existsSync(SUITE_PATH)) {
  suite = loadSuite(readFileSync(SUITE_PATH, "utf-8"));
}

let added = 0;
for (const file of tmpFiles) {
  const hash = file.replace(".json", "");
  if (hash in suite.scenarios) continue;
  const scenario: PersistedScenario = JSON.parse(readFileSync(join(TMP_DIR, file), "utf-8"));
  suite.scenarios[hash] = scenario;
  added++;
}

writeFileSync(SUITE_PATH, JSON.stringify(suite, null, 2) + "\n");
writeFileSync(HASHES_PATH, JSON.stringify(Object.keys(suite.scenarios), null, 2) + "\n");
rmSync(TMP_DIR, { recursive: true });

console.log(`Merged ${added} new scenarios (${Object.keys(suite.scenarios).length} total).`);
