import { loadGenreQuestion } from "./questions.js";
import { evaluateGenre } from "./evaluate.js";
import { createReport } from "./report.js";
import { printReport } from "../../../src/report.js";

export async function execute({ request }: { request: string }): Promise<number> {
  if (request.trim() === "") throw new Error("--request must not be empty");
  const question = await loadGenreQuestion();
  const result = await evaluateGenre(question, request);
  printReport(createReport(question, result));
  return result.error === null ? 0 : 3;
}
