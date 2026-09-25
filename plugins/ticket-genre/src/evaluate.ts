import { experimental_evaluate as evaluate } from "ai";
import type { GenreQuestion } from "./questions.js";

export interface EvaluationResult {
  // Every genre with its probability, most likely first; empty when the evaluation failed.
  probabilities: { genre: string; probability: number }[];
  error: string | null;
}

export async function evaluateGenre(question: GenreQuestion, request: string): Promise<EvaluationResult> {
  try {
    const { answers } = await evaluate({
      model: "typesafe-ai/jev",
      state: `# Request\n${request.trim()}`,
      maxRetries: 5,
      questions: {
        genre: {
          type: "choice",
          instructions: `${question.question}\n\n${question.note}`,
          criteria: question.criteria,
        },
      },
    });
    const { probabilities } = answers.genre;
    if (!probabilities) throw new Error("the evaluation returned no probabilities");
    return {
      probabilities: Object.keys(question.criteria)
        .map((genre) => ({ genre, probability: probabilities[genre] ?? 0 }))
        .sort((left, right) => right.probability - left.probability),
      error: null,
    };
  } catch (error) {
    return { probabilities: [], error: error instanceof Error ? error.message : String(error) };
  }
}
