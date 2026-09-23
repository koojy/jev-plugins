# Rule Review

A Jev plugin that checks development rules for topic mismatches, ambiguity, and contradictions.

## Setup

Requires Node.js 22.12 or later and pnpm.
Run the following commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm cli rule-review --help
```

Set `AI_GATEWAY_API_KEY` in the environment where you run evaluations.
The plugin calls `typesafe-ai/jev` through Vercel AI Gateway.
To load an environment file, use `node --import tsx --env-file=/path/to/.env src/cli.ts rule-review ...`.
Do not commit credentials or environment files to this repository.

## Check rules

Specify the directory containing the rules to evaluate.

```sh
pnpm cli rule-review check --rules /path/to/rules
```

`--rules` reads `.md` files directly inside the given directory.
Question definitions are bundled in the plugin's `questions/` directory.
The model is `typesafe-ai/jev`, with a concurrency limit of 4.
Results are written to stdout for the calling agent to consume.
API error details are written to stderr.

To check only the rules you added or changed, pass them with `--target`.

```sh
pnpm cli rule-review check --rules /path/to/rules --target new-rule.md changed-rule.md
```

Targets are matched by file name inside `--rules`, so paths such as `agents/rules/new-rule.md` also work.
Single-rule checks run only for the targets, and cross-rule checks run only for pairs that include a target.
For t targets among n rules, the cross-rule check evaluates n × (n − 1) / 2 − (n − t) × (n − t − 1) / 2 pairs.
A target that is not in `--rules` is an input error.

You can also run the CLI from another working directory.

```sh
/path/to/jev-plugins/node_modules/.bin/tsx /path/to/jev-plugins/src/cli.ts rule-review check \
  --rules ./rules
```

## Checks

- Instructions that introduce concerns outside the stated topic.
- Ambiguous instructions that allow the same implementation to be interpreted as either compliant or non-compliant.
- Contradictory instructions within a rule.
- Instructions in separate rules that cannot be followed simultaneously.

Evaluations are nondeterministic, and findings are intended for human review.
They are not security audits or guarantees that the rules are correct or complete.
Without `--target`, every unique pair of rules is evaluated, regardless of file names or project layout.
Scope metadata is passed to the model; the CLI does not filter pairs by directory names or glob patterns.
For n rule files without `--target`, the cross-rule check evaluates n × (n − 1) / 2 pairs.

Evaluations send rule bodies, metadata, and the bundled questions to an external API.
The plugin reads the rules and outputs results without modifying them.
Keep project-specific rules and evaluation results in the consuming project.

Exit codes are `0` for completion, `1` for input or configuration errors, `2` when no checks apply, and `3` for API errors.
Findings alone do not cause a nonzero exit code.

## Development

Dependencies and the CLI entry point are managed at the repository root.
This plugin contains its command definitions, evaluation logic, and question definitions.

- `src/command.ts` parses arguments and calls `execute()`.
- `src/execute.ts` coordinates input loading, evaluation, and reporting, and determines the exit code.
- `src/questions.ts` loads and validates the bundled question YAML files.
- `src/rules.ts` reads rule Markdown files and their metadata.
- `src/tasks.ts` builds single-rule and rule-pair tasks, including the text sent to Jev.
- `src/evaluate.ts` runs one evaluation through the AI SDK.
- `src/report.ts` classifies the results and converts them into the shared `Report` type.

The root `src/report.ts` and `src/logger.ts` handle result formatting and diagnostic output.
