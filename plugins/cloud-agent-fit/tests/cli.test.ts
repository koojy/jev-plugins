import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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

test("check lists only the draft option without API credentials", () => {
  const result = run(["cloud-agent-fit", "check", "--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual([...result.stdout.matchAll(/^\s+.*?(--[\w-]+)/gm)].map((match) => match[1]), ["--draft", "--help"]);
});

test("invalid commands and an empty draft fail before calling any API", () => {
  const cases: [string[], RegExp][] = [
    [["cloud-agent-fit", "unknown"], /unknown command/],
    [["cloud-agent-fit", "check"], /required option/],
    [["cloud-agent-fit", "check", "--draft", "本文", "--model", "x"], /unknown option/],
    [["cloud-agent-fit", "check", "--draft", " "], /--draft must not be empty/],
  ];
  for (const [args, error] of cases) {
    const result = run(args);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, error);
  }
});

test("CLI takes the ticket as an argument and writes no files", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "jev-fit-cli-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const provider = join(cwd, "provider.mjs");
  await writeFile(provider, `
    import { Experimental_EvaluationMockModelV4 } from ${JSON.stringify(import.meta.resolve("ai/test"))};
    globalThis.AI_SDK_DEFAULT_PROVIDER = {
      evaluationModel: () => new Experimental_EvaluationMockModelV4({
        doEvaluate: async () => ({ answers: { verdict: { type: "boolean", probability: 1 } }, warnings: [] }),
      }),
    };
  `);
  const filesBefore = await readdir(cwd);
  const result = run(["cloud-agent-fit", "check", "--draft", "## 変更内容\n\nCIにキャッシュを入れる\n"], cwd, provider);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\nDecision\n {2}Cloud Agent\n\nErrors: 0\n$/);
  assert.deepEqual(await readdir(cwd), filesBefore);
});
