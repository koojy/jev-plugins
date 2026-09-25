# Jev Plugins

A collection of Jev-based checks for personal development workflows.
Each plugin contains its evaluation logic and question definitions, and runs through a shared CLI.

## Usage

Requires Node.js 22.12 or later and pnpm.
Install dependencies and run commands from the repository root.
Set `AI_GATEWAY_API_KEY` to run evaluations.

```sh
pnpm install --frozen-lockfile
pnpm cli --help
pnpm cli rule-review --help
pnpm cli rule-review check --rules /path/to/rules
pnpm cli rule-review check --rules /path/to/rules --target changed-rule.md
pnpm cli ticket-scope check --request "$request" --draft "$draft"
pnpm cli ticket-genre check --request "$request"
```

## Plugins

| Plugin | Purpose |
| --- | --- |
| [cloud-agent-fit](plugins/cloud-agent-fit/README.md) | Decide whether a completed ticket can go to a cloud coding agent. |
| [rule-review](plugins/rule-review/README.md) | Check development rules for topic mismatches, ambiguity, and contradictions within or between rules. |
| [ticket-genre](plugins/ticket-genre/README.md) | Decide the genre of a development request. |
| [ticket-scope](plugins/ticket-scope/README.md) | Flag ticket draft items that go beyond the original request and the requester's answers. |

See each plugin's README and command `--help` for usage details.

## Structure

```text
package.json
pnpm-lock.yaml
src/
  cli.ts
  logger.ts
  report.ts
plugins/
  cloud-agent-fit/
  rule-review/
    README.md
    src/
      command.ts
      execute.ts
    questions/
    tests/
  ticket-genre/
  ticket-scope/
tests/
```

The repository root manages dependencies and the CLI entry point.
`src/logger.ts` defines a shared Consola logger that writes diagnostics to stderr.
`src/report.ts` renders each plugin's `Report` to stdout using a common format for section headings, items, and error counts.
Error details go through the shared logger.

Each plugin lives under `plugins/`.
Within a plugin, `src/command.ts` defines its commands and calls `execute()` in `src/execute.ts`.
`execute.ts` coordinates the workflow; input loading, evaluation, and report preparation live in files organized by responsibility.
To add a plugin, create its directory under `plugins/`, register its commands in the root `src/cli.ts`, and add it to the table above.

## Development

```sh
pnpm test
pnpm typecheck
```

## License

[MIT](LICENSE) © 2026 Koji Murakami
