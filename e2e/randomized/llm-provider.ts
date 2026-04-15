import { GoogleGenerativeAI } from "@google/generative-ai";

export interface EvaluationResult {
  confidence: number;
  reasoning: string;
  suspiciousSteps: number[];
  proposedLayouts: Record<number, (string | null)[][]>;
}

export interface LLMProvider {
  evaluate(prompt: string): Promise<EvaluationResult>;
}

function parseEvaluationResponse(text: string): EvaluationResult {
  const stripped = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "");
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { confidence: 0, reasoning: "Failed to parse LLM response: " + text, suspiciousSteps: [], proposedLayouts: {} };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const proposedLayouts: Record<number, (string | null)[][]> = {};
    if (parsed.proposedLayouts && typeof parsed.proposedLayouts === "object") {
      for (const [k, v] of Object.entries(parsed.proposedLayouts)) {
        const idx = Number(k);
        if (!isNaN(idx) && Array.isArray(v)) {
          proposedLayouts[idx] = v as (string | null)[][];
        }
      }
    }
    return {
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || ""),
      suspiciousSteps: Array.isArray(parsed.suspiciousSteps)
        ? parsed.suspiciousSteps.map(Number).filter((n: number) => !isNaN(n))
        : [],
      proposedLayouts,
    };
  } catch {
    return { confidence: 0, reasoning: "Failed to parse LLM JSON: " + text, suspiciousSteps: [], proposedLayouts: {} };
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
    this.model = model ?? process.env.LLM_MODEL ?? "gemini-2.5-flash-lite";
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
