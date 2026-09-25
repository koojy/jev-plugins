# Cloud Agent Fit

A Jev plugin that decides whether a completed development ticket can go to a cloud coding agent.

## Setup

Requires Node.js 22.12 or later and pnpm.
Run the following commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm cli cloud-agent-fit --help
```

Set `AI_GATEWAY_API_KEY` in the environment where you run evaluations.
The plugin calls `typesafe-ai/jev` through Vercel AI Gateway.

## Check a ticket

Pass the text itself, not a file path.
A caller such as an agent can pass multi-line text through a quoted heredoc, so nothing is written to disk.

```sh
pnpm cli cloud-agent-fit check --draft "$(cat <<'EOF'
## 変更内容

保存ボタンの文言を「保存」から「保存する」に変える。
EOF
)"
```

`--draft` is the completed ticket in Markdown.
Each question in `questions/` is asked about the ticket.

- `autonomous`: a coding agent working alone in a cloud environment can implement the ticket and meet its completion conditions without asking a person for any decision or operation.
- `convergent`: independent implementations would agree on observable behavior and on the scope of what they change.

## Report

`Checks` lists each question's probability and threshold.
`Decision` shows `Cloud Agent` only when every question reaches its `at`, and `None` otherwise.
A failed evaluation also leaves the decision at `None`.

Evaluations are nondeterministic, and they judge the ticket text only without reading the repository.
The thresholds are initial values; before relying on them, run tickets whose outcome with a cloud agent you already know and compare the results.

Evaluations send the ticket to an external API.
The plugin writes no files.

Exit codes are `0` for completion, `1` for input or configuration errors, and `3` for API errors.
A `None` decision alone does not cause a nonzero exit code.

## Development

- `src/command.ts` defines `check` and calls `execute()`.
- `src/execute.ts` validates the ticket, runs the evaluations, and determines the exit code.
- `src/questions.ts` loads and validates the bundled question YAML files.
- `src/evaluate.ts` builds the text sent to Jev and asks one question.
- `src/report.ts` makes the decision and converts it into the shared `Report` type.
