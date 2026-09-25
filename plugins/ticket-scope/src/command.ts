import { Command } from "commander";

interface Flags {
  request: string;
  draft: string;
  convention?: string;
  skip?: string[];
}

export function registerTicketScope(program: Command): void {
  program.command("ticket-scope")
    .description("Find ticket requirements that go beyond the request")
    .command("check")
    .description("Flag draft items that the request and the requester's answers neither state nor imply")
    .requiredOption("--request <text>", "The original request and the requester's answers")
    .requiredOption("--draft <text>", "The Markdown ticket draft")
    .option("--convention <text>", "What the repository or the ticket template requires of every ticket")
    .option("--skip <heading...>", "Skip items under headings that start with these texts")
    .action(async ({ request, draft, convention, skip }: Flags) => {
      const { execute } = await import("./execute.js");
      process.exitCode = await execute({ request, draft, convention, skip });
    });
}
