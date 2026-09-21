import { Command } from "commander";
import { logger } from "./logger.js";
import { registerRuleReview } from "../plugins/rule-review/src/command.js";

const program = new Command()
  .name("jev-plugins")
  .description("Jev checks for development workflows")
  .showHelpAfterError();

registerRuleReview(program);

try {
  if (process.argv.length === 2) program.help();
  await program.parseAsync();
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
