import { experimental_evaluate as evaluate } from "ai";
import type { QuestionDefinition } from "./questions.js";

export interface EvaluationResult {
  check: QuestionDefinition;
  // Probability that the question holds for the ticket.
  probability: number;
  error: string | null;
}

export async function evaluateCheck(check: QuestionDefinition, draft: string): Promise<EvaluationResult> {
  try {
    const { answers } = await evaluate({
      model: "typesafe-ai/jev",
      state: `# Ticket\n${draft.trim()}`,
      maxRetries: 5,
      questions: {
        verdict: {
          type: "boolean",
          instructions: `${check.question}\n\n${check.note}`,
          criteria: check.criteria,
        },
      },
    });
    return { check, probability: answers.verdict.probability, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { check, probability: Number.NaN, error: message };
  }
}
