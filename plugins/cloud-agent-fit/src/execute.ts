import { Readable } from "node:stream";
import { loadQuestions } from "./questions.js";
import { evaluateCheck } from "./evaluate.js";
import { createReport } from "./report.js";
import { printReport } from "../../../src/report.js";

export async function execute({ draft }: { draft: string }): Promise<number> {
  if (draft.trim() === "") throw new Error("--draft must not be empty");
  const checks = await loadQuestions();
  const results = await Readable.from(checks)
    .map((check) => evaluateCheck(check, draft), { concurrency: 4 })
    .toArray();
  printReport(createReport(results));
  return results.some((result) => result.error !== null) ? 3 : 0;
}
