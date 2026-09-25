import { Readable } from "node:stream";
import { loadQuestions } from "./questions.js";
import { parseDraft, type DraftItem } from "./draft.js";
import { evaluateItem, type EvaluationResult } from "./evaluate.js";
import { createReport } from "./report.js";
import { printReport } from "../../../src/report.js";
import { logger } from "../../../src/logger.js";

export interface Options {
  // The original request and the requester's answers, as text.
  request: string;
  // The Markdown ticket draft, as text.
  draft: string;
  // What the repository or the ticket template requires of every ticket, as text.
  convention?: string;
  // Items under a heading that starts with any of these texts are not checked.
  skip?: string[];
}

export async function execute({ request, draft, convention, skip = [] }: Options): Promise<number> {
  if (request.trim() === "") throw new Error("--request must not be empty");
  if (convention?.trim() === "") throw new Error("--convention must not be empty");
  if (skip.some((prefix) => prefix.trim() === "")) throw new Error("--skip headings must not be empty");
  const questions = await loadQuestions();
  const items = parseDraft(draft);
  const skips = (item: DraftItem, prefix: string) => item.headings.some((heading) => heading.startsWith(prefix));
  for (const prefix of skip) {
    if (!items.some((item) => skips(item, prefix))) logger.warn(`No items under a heading that starts with: ${prefix}`);
  }
  const targets = items.filter((item) => !skip.some((prefix) => skips(item, prefix)));
  if (targets.length === 0) {
    logger.error("No draft items to check. Nothing was checked.");
    return 2;
  }
  const tasks = questions.flatMap((check) => targets.map((item) => ({ check, item })));
  const results: EvaluationResult[] = await Readable.from(tasks)
    .map(({ check, item }) => evaluateItem(check, request, item, convention), { concurrency: 4 })
    .toArray();
  printReport(createReport(results));
  return results.some((result) => result.error !== null) ? 3 : 0;
}
