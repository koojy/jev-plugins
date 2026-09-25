# Ticket Genre

A Jev plugin that decides the genre of a development request: Feature, Improvement, Bug, Experiment, Norm, or Ops.

## Setup

Requires Node.js 22.12 or later and pnpm.
Run the following commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm cli ticket-genre --help
```

Set `AI_GATEWAY_API_KEY` in the environment where you run evaluations.
The plugin calls `typesafe-ai/jev` through Vercel AI Gateway.

## Check a request

Pass the text itself, not a file path.
A caller such as an agent can pass multi-line text through a quoted heredoc, so nothing is written to disk.

```sh
pnpm cli ticket-genre check --request "$(cat <<'EOF'
CIにキャッシュを入れて、ビルドを速くしたい。
EOF
)"
```

`--request` is the development request and the requester's answers.
Jev picks one genre from the definitions in `questions/genre.yml`.
The genres are judged by what the change does to the intended state of the product or process, not by whether it touches the UI or how small it is.

## Report

`Genres` lists every genre with its probability, most likely first.
`Decision` shows the most likely genre when its probability reaches the question's `at`, and `None` otherwise.
Treat `None` as a request whose genre needs a person's decision.

Evaluations are nondeterministic.
The threshold is an initial value; before relying on it, run requests whose genres you already know and compare the results.

Evaluations send the request to an external API.
The plugin writes no files.

Exit codes are `0` for completion, `1` for input or configuration errors, and `3` for API errors.
A `None` decision alone does not cause a nonzero exit code.

## Development

- `src/command.ts` defines `check` and calls `execute()`.
- `src/execute.ts` validates the request, runs the evaluation, and determines the exit code.
- `src/questions.ts` loads and validates the bundled question YAML file.
- `src/evaluate.ts` builds the text sent to Jev and asks the choice question.
- `src/report.ts` makes the decision and converts it into the shared `Report` type.
