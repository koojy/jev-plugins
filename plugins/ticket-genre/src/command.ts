import { Command } from "commander";

export function registerTicketGenre(program: Command): void {
  program.command("ticket-genre")
    .description("Decide the genre of a development request")
    .command("check")
    .description("Pick one genre for the request, or none when no genre is likely enough")
    .requiredOption("--request <text>", "The development request and the requester's answers")
    .action(async ({ request }: { request: string }) => {
      const { execute } = await import("./execute.js");
      process.exitCode = await execute({ request });
    });
}
