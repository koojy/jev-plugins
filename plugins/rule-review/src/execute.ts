import { Readable } from "node:stream";
import { loadQuestions } from "./questions.js";
import { loadRules } from "./rules.js";
import { createTasks } from "./tasks.js";
import { evaluateTask, type EvaluationResult } from "./evaluate.js";
import { createReport } from "./report.js";
import { printReport } from "../../../src/report.js";
import { logger } from "../../../src/logger.js";

export async function execute(rulesDir: string): Promise<number> {
  const [questions, rules] = await Promise.all([loadQuestions(), loadRules(rulesDir)]);
  const tasks = createTasks(questions, rules);
  if (tasks.length === 0) {
    logger.error("No applicable checks or input documents. Nothing was checked.");
    return 2;
  }
  const results: EvaluationResult[] = await Readable.from(tasks)
    .map(evaluateTask, { concurrency: 4 })
    .toArray();
  printReport(createReport(results));
  return results.some((result) => result.error !== null) ? 3 : 0;
}
