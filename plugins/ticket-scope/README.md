# Ticket Scope

A Jev plugin that flags items in a ticket draft that go beyond the original request and the requester's answers, and items that prescribe how the work is implemented.

## Setup

Requires Node.js 22.12 or later and pnpm.
Run the following commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm cli ticket-scope --help
```

Set `AI_GATEWAY_API_KEY` in the environment where you run evaluations.
The plugin calls `typesafe-ai/jev` through Vercel AI Gateway.

## Check a draft

Pass the texts themselves, not file paths.
A caller such as an agent can pass multi-line text through a quoted heredoc, so nothing is written to disk.

```sh
pnpm cli ticket-scope check --convention "$convention" \
  --request "$(cat <<'EOF'
メモを保存できるようにしたい。
Q: 保存後にどこへ戻る？ A: 一覧へ戻る。
EOF
)" \
  --draft "$(cat <<'EOF'
## 承認済みシナリオ

1. 保存ボタンを押すとメモが保存され、一覧へ戻る
2. 保存に失敗したら「保存できませんでした」と3秒表示する
EOF
)"
```

`--request` is the original request and every answer, correction, and approval the requester gave while the ticket was drafted.
Only what this text says counts as requested, so leave nothing out.

`--draft` is the ticket draft in Markdown.
Each paragraph and each top-level list item is checked as one item, together with the headings above it.
Nested lists and code blocks stay with the item they belong to.

`--convention` is optional text with what the repository or the ticket template requires of every ticket, such as the standard completion conditions.
An item that states a convention or applies it to this ticket is not counted as an addition, so sections filled in from conventions can be checked too.
Pass the conventions as written; a summary or an inference in this text would hide additions.

`--skip` leaves out items under headings that start with the given texts, including their subheadings.
A skip text that matches no heading is reported as a warning.

## Checks

Each item is asked whether it requires anything beyond what the request, the answers, and any given conventions state or necessarily imply.
An item necessarily follows only when any work that satisfies the request would satisfy it.
Extra behaviors, error cases, limits, defaults, concrete values or wording, and decisions the requester did not make count as additions, even when they are reasonable.
Naming the target repository, base branch, or reference documents, running the repository's standard verification commands, and listing excluded work do not.

Each item is also asked whether it prescribes how the work is implemented rather than the observable result, public contract, or constraint it must meet.
Internal records or state, database tables or columns, module split, library selection, where a setting is stored, assigning internal work to the ticket, and the mechanism behind a behavior count as implementation details, even when the request describes them.
API endpoints, fields, status codes, and error codes count too, because a ticket states the behavior they serve. Saying that an existing system is left unchanged does not.

The questions are bundled in `questions/unrequested-requirement.yml` and `questions/implementation-detail.yml`.
The model is `typesafe-ai/jev`, with a concurrency limit of 4.
One run makes one call per checked item for each question.

## Report

`Findings` lists items at or above the question's `at` probability, and `Borderline` lists items at or above `loose`.
Each line shows the question ID (`unrequested-requirement` or `implementation-detail`), the item's line in the draft as `L12`, the probability, and the first line of the item, in draft order.
Items below `loose` are not listed.
Evaluations that failed are listed under errors.

Evaluations are nondeterministic, and findings are intended for the requester to confirm or remove, not to be removed automatically.
The check does not detect requirements the draft dropped or narrowed.
Before relying on the thresholds, run drafts whose added items you already know and compare the results.

Evaluations send the request, the conventions, and each checked item to an external API.
The plugin writes no files.

Exit codes are `0` for completion, `1` for input or configuration errors, `2` when the draft has no items to check, and `3` for API errors.
Findings alone do not cause a nonzero exit code.

## Development

- `src/command.ts` defines `check` and calls `execute()`.
- `src/execute.ts` validates the inputs, applies `--skip`, evaluates each item, and determines the exit code.
- `src/questions.ts` loads and validates the bundled question YAML files.
- `src/draft.ts` splits the Markdown draft into items with their headings and line numbers.
- `src/evaluate.ts` builds the text sent to Jev and asks the question for one item.
- `src/report.ts` classifies the results and converts them into the shared `Report` type.
