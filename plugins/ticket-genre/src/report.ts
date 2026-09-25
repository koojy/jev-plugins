import type { Report } from "../../../src/report.js";
import type { EvaluationResult } from "./evaluate.js";
import type { GenreQuestion } from "./questions.js";

// Decision stays empty, printed as None, when the top genre is below the question's threshold.
export function createReport(question: GenreQuestion, result: EvaluationResult): Report {
  const [top] = result.probabilities;
  return {
    sections: [
      { title: "Genres", items: result.probabilities.map(({ genre, probability }) => `${genre} p=${probability.toFixed(2)}`) },
      { title: "Decision", items: top && top.probability >= question.at ? [top.genre] : [] },
    ],
    errors: result.error === null ? [] : [`${question.id}: ${result.error}`],
  };
}
