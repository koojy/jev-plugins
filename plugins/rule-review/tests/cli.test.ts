import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const entry = fileURLToPath(new URL("../../../src/cli.ts", import.meta.url));
function run(args: string[], cwd?: string, provider?: string) {
  const env = { ...process.env };
  delete env.AI_GATEWAY_API_KEY;
  const imports = provider ? ["--import", provider] : [];
  const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), ...imports, entry, ...args], { cwd, env, encoding: "utf8", timeout: 15_000 });
  assert.ifError(result.error);
  return result;
}

test("help lists only the rules option and built-in help without API credentials", () => {
  const result = run(["rule-review", "check", "--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual([...result.stdout.matchAll(/^\s+.*?(--[\w-]+)/gm)].map((match) => match[1]), ["--rules", "--help"]);
});

test("invalid commands and removed options fail before execution", () => {
  const cases: [string[], RegExp][] = [
    [["rule-review", "unknown"], /unknown command/],
    [["rule-review", "check"], /required option/],
    [["rule-review", "check", "--rules"], /argument missing/],
    [["rule-review", "check", "--rules", ".", "extra"], /too many arguments/],
    ...["name", "questions", "model", "concurrency", "out", "cache", "dry-run", "replay"].map((name): [string[], RegExp] =>
      [["rule-review", "check", "--rules", ".", `--${name}`], /unknown option/]),
  ];
  for (const [args, error] of cases) {
    const result = run(args);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, error);
  }
});

test("CLI uses bundled questions from another directory and writes no files", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "jev-cli-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, "rules"));
  await writeFile(join(cwd, "rules", "first.md"), "# First\nUse clear names.\n");
  await writeFile(join(cwd, "rules", "second.md"), "# Second\nKeep functions short.\n");
  const provider = join(cwd, "provider.mjs");
  await writeFile(provider, `
    import { Experimental_EvaluationMockModelV4 } from ${JSON.stringify(import.meta.resolve("ai/test"))};
    globalThis.AI_SDK_DEFAULT_PROVIDER = {
      evaluationModel: () => new Experimental_EvaluationMockModelV4({
        doEvaluate: async () => ({ answers: { verdict: { type: "boolean", probability: 1 } }, warnings: [] }),
      }),
    };
  `);
  const filesBefore = await readdir(cwd, { recursive: true });
  const args = ["rule-review", "check", "--rules", "rules"];
  for (let runIndex = 0; runIndex < 2; runIndex++) {
    const result = run(args, cwd, provider);
    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stdout.match(/p=1\.00/g) ?? []).length, 7);
    assert.match(result.stdout, /Errors: 0/);
    assert.deepEqual(await readdir(cwd, { recursive: true }), filesBefore);
  }
  await mkdir(join(cwd, "empty"));
  assert.equal(run(["rule-review", "check", "--rules", "empty"], cwd).status, 2);
  const missing = run(["rule-review", "check", "--rules", "missing"], cwd);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /ENOENT/);
  assert.doesNotMatch(missing.stderr, /\n\s+at /);
});
