import { Command } from "commander";

export function registerCloudAgentFit(program: Command): void {
  program.command("cloud-agent-fit")
    .description("Decide whether a ticket can go to a cloud coding agent")
    .command("check")
    .description("Check that an agent can implement the ticket alone and that implementations would converge")
    .requiredOption("--draft <text>", "The completed Markdown ticket")
    .action(async ({ draft }: { draft: string }) => {
      const { execute } = await import("./execute.js");
      process.exitCode = await execute({ draft });
    });
}
