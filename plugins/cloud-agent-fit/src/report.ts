import type { Report } from "../../../src/report.js";
import type { EvaluationResult } from "./evaluate.js";

export const DECISION = "Cloud Agent";

// The decision is made only when every question succeeded and reached its threshold.
export function createReport(results: EvaluationResult[]): Report {
  const fits = results.every(({ check, probability, error }) => error === null && probability >= check.at);
  return {
    sections: [
      {
        title: "Checks",
        items: results.filter((row) => row.error === null)
          .map(({ check, probability }) => `${check.id} p=${probability.toFixed(2)} at=${check.at.toFixed(2)}`),
      },
      { title: "Decision", items: fits ? [DECISION] : [] },
    ],
    errors: results.filter((row) => row.error !== null).map((row) => `${row.check.id}: ${row.error}`),
  };
}
