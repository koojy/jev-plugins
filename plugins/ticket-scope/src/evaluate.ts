import { experimental_evaluate as evaluate } from "ai";
import type { DraftItem } from "./draft.js";
import type { QuestionDefinition } from "./questions.js";

export interface EvaluationResult {
  check: QuestionDefinition;
  item: DraftItem;
  // Probability that the item goes beyond the request.
  probability: number;
  error: string | null;
}

// Conventions are what the repository or the ticket template requires of every ticket, not what was requested.
export function itemState(request: string, item: DraftItem, convention?: string): string {
  return [
    "# Request and answers",
    request.trim(),
    "",
    ...convention === undefined ? [] : ["# Conventions", convention.trim(), ""],
    "# Draft item",
    `section: ${item.headings.join(" > ") || "(none)"}`,
    "",
    item.text,
  ].join("\n");
}

export async function evaluateItem(
  check: QuestionDefinition,
  request: string,
  item: DraftItem,
  convention?: string,
): Promise<EvaluationResult> {
  try {
    const { answers } = await evaluate({
      model: "typesafe-ai/jev",
      state: itemState(request, item, convention),
      maxRetries: 5,
      questions: {
        verdict: {
          type: "boolean",
          instructions: `${check.question}\n\n${check.note}`,
          criteria: check.criteria,
        },
      },
    });
    return { check, item, probability: answers.verdict.probability, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { check, item, probability: Number.NaN, error: message };
  }
}
