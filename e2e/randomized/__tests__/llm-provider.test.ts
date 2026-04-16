import { describe, it, expect } from "vitest";
import { parseEvaluationResponse } from "../llm-provider";

describe("parseEvaluationResponse", () => {
  it("parses a valid perStep response and derives aggregated fields", () => {
    const response = JSON.stringify({
      perStep: [
        {
          intent: "swap a and b",
          prediction: [["b", "a"]],
          differences: [],
          invariants: "all pass",
          confidence: 95,
          proposal: null,
        },
        {
          intent: "dragToColumn(c, col=1)",
          prediction: [["a", "c"]],
          differences: ["row 0 col 1: predicted c, engine null"],
          invariants: "all pass",
          confidence: 30,
          proposal: [["a", "c"]],
        },
      ],
    });

    const result = parseEvaluationResponse(response);

    expect(result.perStep).toHaveLength(2);
    expect(result.perStep[0].confidence).toBe(95);
    expect(result.perStep[1].proposal).toEqual([["a", "c"]]);

    expect(result.confidence).toBe(30);
    expect(result.suspiciousSteps).toEqual([1]);
    expect(result.proposedLayouts).toEqual({ 1: [["a", "c"]] });
    expect(result.reasoning).toContain("swap a and b");
    expect(result.reasoning).toContain("dragToColumn(c, col=1)");
  });

  it("treats null proposals as 'no proposal'", () => {
    const response = JSON.stringify({
      perStep: [
        {
          intent: "no-op expected",
          prediction: [["a"]],
          differences: [],
          invariants: "all pass",
          confidence: 50,
          proposal: null,
        },
      ],
    });

    const result = parseEvaluationResponse(response);

    expect(result.suspiciousSteps).toEqual([0]);
    expect(result.proposedLayouts).toEqual({});
  });

  it("handles markdown-fenced JSON", () => {
    const response = "```json\n" + JSON.stringify({
      perStep: [{
        intent: "x",
        prediction: null,
        differences: null,
        invariants: "all pass",
        confidence: 80,
        proposal: null,
      }],
    }) + "\n```";

    const result = parseEvaluationResponse(response);
    expect(result.confidence).toBe(80);
  });

  it("returns safe defaults on malformed JSON", () => {
    const result = parseEvaluationResponse("not json at all");

    expect(result.perStep).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.suspiciousSteps).toEqual([]);
    expect(result.proposedLayouts).toEqual({});
    expect(result.reasoning).toContain("Failed to parse");
  });

  it("clamps per-step confidence to 0-100", () => {
    const response = JSON.stringify({
      perStep: [
        { intent: "x", prediction: null, differences: null, invariants: "x", confidence: 150, proposal: null },
        { intent: "y", prediction: null, differences: null, invariants: "y", confidence: -10, proposal: null },
      ],
    });

    const result = parseEvaluationResponse(response);
    expect(result.perStep[0].confidence).toBe(100);
    expect(result.perStep[1].confidence).toBe(0);
    expect(result.confidence).toBe(0);
  });
});
