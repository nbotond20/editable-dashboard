import { GoogleGenerativeAI } from "@google/generative-ai";

export interface PerStepResult {
  intent: string;
  prediction: (string | null)[][] | null;
  differences: string[] | null;
  invariants: string;
  confidence: number;
  proposal: (string | null)[][] | null;
}

export interface EvaluationResult {
  perStep: PerStepResult[];
  confidence: number;
  reasoning: string;
  suspiciousSteps: number[];
  proposedLayouts: Record<number, (string | null)[][]>;
}

export interface LLMProvider {
  evaluate(prompt: string): Promise<EvaluationResult>;
}

function clampConfidence(n: unknown): number {
  const num = Number(n);
  if (!isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function parsePerStep(raw: unknown): PerStepResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((step): PerStepResult => {
    const s = (step ?? {}) as Record<string, unknown>;
    return {
      intent: typeof s.intent === "string" ? s.intent : "",
      prediction: Array.isArray(s.prediction) ? (s.prediction as (string | null)[][]) : null,
      differences: Array.isArray(s.differences)
        ? s.differences.filter((x): x is string => typeof x === "string")
        : null,
      invariants: typeof s.invariants === "string" ? s.invariants : "",
      confidence: clampConfidence(s.confidence),
      proposal: Array.isArray(s.proposal) ? (s.proposal as (string | null)[][]) : null,
    };
  });
}

function aggregate(perStep: PerStepResult[]): Omit<EvaluationResult, "perStep"> {
  if (perStep.length === 0) {
    return { confidence: 0, reasoning: "", suspiciousSteps: [], proposedLayouts: {} };
  }
  const confidence = perStep.reduce((min, s) => Math.min(min, s.confidence), 100);
  const suspiciousSteps = perStep
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.confidence < 70)
    .map(({ i }) => i);
  const proposedLayouts: Record<number, (string | null)[][]> = {};
  perStep.forEach((s, i) => {
    if (s.proposal !== null) proposedLayouts[i] = s.proposal;
  });
  const reasoning = perStep
    .map((s, i) => `Step ${i}: ${s.intent} | invariants: ${s.invariants}` +
      (s.differences && s.differences.length ? ` | diffs: ${s.differences.join("; ")}` : ""))
    .join("\n");
  return { confidence, reasoning, suspiciousSteps, proposedLayouts };
}

export function parseEvaluationResponse(text: string): EvaluationResult {
  const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "");
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      perStep: [],
      confidence: 0,
      reasoning: "Failed to parse LLM response: " + text,
      suspiciousSteps: [],
      proposedLayouts: {},
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const perStep = parsePerStep(parsed.perStep);
    const aggregated = aggregate(perStep);
    return { perStep, ...aggregated };
  } catch {
    return {
      perStep: [],
      confidence: 0,
      reasoning: "Failed to parse LLM JSON: " + text,
      suspiciousSteps: [],
      proposedLayouts: {},
    };
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 2000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable = message.includes("503") || message.includes("429") || message.includes("overloaded");
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`    Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required");
    this.client = new GoogleGenerativeAI(key);
    this.model = model ?? process.env.LLM_MODEL ?? "gemini-2.5-flash";
  }

  async evaluate(prompt: string): Promise<EvaluationResult> {
    const text = await withRetry(async () => {
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: { responseMimeType: "application/json" },
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    return parseEvaluationResponse(text);
  }
}

export function createProvider(): LLMProvider {
  return new GeminiProvider();
}
