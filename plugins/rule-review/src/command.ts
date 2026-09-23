import { Command } from "commander";

export function registerRuleReview(program: Command): void {
  program.command("rule-review")
    .description("Check development rules for ambiguity and contradictions")
    .command("check")
    .description("Check development rules using bundled question definitions")
    .requiredOption("--rules <directory>", "Markdown rule directory")
    .option("--target <file...>", "Check only these rule files and their pairs with every other rule")
    .action(async ({ rules, target }: { rules: string; target?: string[] }) => {
      const { execute } = await import("./execute.js");
      process.exitCode = await execute(rules, target);
    });
}
