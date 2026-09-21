import { Command } from "commander";

export function registerRuleReview(program: Command): void {
  program.command("rule-review")
    .description("Check development rules for ambiguity and contradictions")
    .command("check")
    .description("Check development rules using bundled question definitions")
    .requiredOption("--rules <directory>", "Markdown rule directory")
    .action(async ({ rules }: { rules: string }) => {
      const { execute } = await import("./execute.js");
      process.exitCode = await execute(rules);
    });
}
