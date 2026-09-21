import type { Report } from "../../../src/report.js";
import type { EvaluationResult } from "./evaluate.js";

export function createReport(results: EvaluationResult[]): Report {
  const groups = [
    ["Findings", results.filter(({ check, probability }) => probability >= check.at)],
    ["Borderline", results.filter(({ check, probability }) => probability >= check.loose && probability < check.at)],
  ] as const;
  return {
    sections: groups.map(([title, rows]) => ({
      title,
      items: rows.sort((left, right) => right.probability - left.probability)
        .map((row) => `${row.check.id} ${row.label} p=${row.probability.toFixed(2)}`),
    })),
    errors: results.filter((row) => row.error !== null)
      .map((row) => `${row.check.id} ${row.label}: ${row.error}`),
  };
}
