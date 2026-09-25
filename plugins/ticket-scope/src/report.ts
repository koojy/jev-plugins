import type { Report } from "../../../src/report.js";
import type { EvaluationResult } from "./evaluate.js";

function excerpt(text: string): string {
  const first = text.split("\n")[0].replace(/\s+/g, " ").trim();
  return first.length > 80 ? `${first.slice(0, 79)}…` : first;
}

// Items stay in draft order so the caller can walk the draft from top to bottom.
export function createReport(results: EvaluationResult[]): Report {
  const location = ({ check, item }: EvaluationResult) => `${check.id} L${item.line}`;
  const groups = [
    ["Findings", results.filter(({ check, probability }) => probability >= check.at)],
    ["Borderline", results.filter(({ check, probability }) => probability >= check.loose && probability < check.at)],
  ] as const;
  return {
    sections: groups.map(([title, rows]) => ({
      title,
      items: rows.map((row) => `${location(row)} p=${row.probability.toFixed(2)} ${excerpt(row.item.text)}`),
    })),
    errors: results.filter((row) => row.error !== null).map((row) => `${location(row)}: ${row.error}`),
  };
}
