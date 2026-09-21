import { experimental_evaluate as evaluate } from "ai";
import type { QuestionDefinition } from "./questions.js";
import type { Task } from "./tasks.js";

export interface EvaluationResult {
  check: QuestionDefinition;
  label: string;
  probability: number;
  error: string | null;
}

export async function evaluateTask({ check, subject }: Task): Promise<EvaluationResult> {
  try {
    const { answers } = await evaluate({
      model: "typesafe-ai/jev",
      state: subject.state,
      maxRetries: 5,
      questions: {
        verdict: {
          type: "boolean",
          instructions: `${check.question}\n\n${check.note}`,
          criteria: check.criteria,
        },
      },
    });
    return { check, label: subject.label, probability: answers.verdict.probability, error: null };
  } catch (error) {
    return {
      check,
      label: subject.label,
      probability: Number.NaN,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
