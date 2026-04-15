import { evaluateScenarios } from "./llm-evaluator";

evaluateScenarios()
  .then(({ evaluated, invariantFailed, llmEvaluated }) => {
    console.log(`\nSummary: ${evaluated} evaluated, ${invariantFailed} invariant failures, ${llmEvaluated} LLM evaluations.`);
  })
  .catch(err => {
    console.error("Evaluation failed:", err);
    process.exit(1);
  });
