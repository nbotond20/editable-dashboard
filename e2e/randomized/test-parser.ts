import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(DIR, "parsed-tests-cache.json");
const TEST_FILE = join(DIR, "..", "drag-test-cases.spec.ts");

export interface ParsedExample {
  group: string;
  layout: string[];
  maxColumns: number;
  name: string;
  action: {
    do: string;
    source: string;
    target?: string;
    side?: string;
    col?: number;
    ref?: string;
    direction?: string;
  };
  expected: (string | null)[][];
}

function parseTestFile(): ParsedExample[] {
  const source = readFileSync(TEST_FILE, "utf-8");
  const examples: ParsedExample[] = [];

  const groupRegex = /\{\s*group:\s*"([^"]+)"(?:,\s*layout:\s*(\[[^\]]*\]))?,\s*scenarios:\s*\[/g;
  let groupMatch;

  while ((groupMatch = groupRegex.exec(source)) !== null) {
    const groupName = groupMatch[1];
    const layoutStr = groupMatch[2];
    const layout = layoutStr ? JSON.parse(layoutStr.replace(/'/g, '"')) as string[] : [];
    const maxColumns = layout.length > 0
      ? Math.max(...layout.map(l => l.split(/\s+/).length))
      : 2;

    const afterGroup = source.slice(groupMatch.index);
    const nextGroupIdx = afterGroup.indexOf("\n  {\n    group:", 1);
    const groupSlice = nextGroupIdx > 0 ? afterGroup.slice(0, nextGroupIdx) : afterGroup;

    const scenarioRegex = /\{\s*name:\s*"([^"]+)",\s*action:\s*(\{[^}]+\}),\s*expected:\s*(\[[\s\S]*?\])\s*\}/g;
    let scenarioMatch;

    while ((scenarioMatch = scenarioRegex.exec(groupSlice)) !== null) {
      const name = scenarioMatch[1];
      const actionStr = scenarioMatch[2]
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":')
        .replace(/,\s*\}/g, "}");
      const expectedStr = scenarioMatch[3].replace(/'/g, '"');

      try {
        const action = JSON.parse(actionStr);
        const expected = JSON.parse(expectedStr);
        examples.push({ group: groupName, layout, maxColumns, name, action, expected });
      } catch {
        // Skip unparseable scenarios
      }
    }
  }

  return examples;
}

export function getParsedExamples(forceRefresh = false): ParsedExample[] {
  if (!forceRefresh && existsSync(CACHE_PATH)) {
    try {
      return JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    } catch {
      // Cache corrupted, regenerate
    }
  }

  const examples = parseTestFile();
  writeFileSync(CACHE_PATH, JSON.stringify(examples, null, 2));
  return examples;
}
