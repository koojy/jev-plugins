import { logger } from "./logger.js";

export interface Report {
  sections: { title: string; items: string[] }[];
  errors: string[];
}

export function printReport(report: Report): void {
  const lines = report.sections.flatMap(({ title, items }) => [
    "", title, ...(items.length ? items : ["None"]).map((item) => `  ${item}`),
  ]);
  lines.push("", `Errors: ${report.errors.length}`);
  process.stdout.write(`${lines.join("\n")}\n`);
  for (const error of report.errors) logger.error(error);
}
