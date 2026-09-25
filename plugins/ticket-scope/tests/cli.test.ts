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

test("check lists only the request, draft, convention and skip options without API credentials", () => {
  const result = run(["ticket-scope", "check", "--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual([...result.stdout.matchAll(/^\s+.*?(--[\w-]+)/gm)].map((match) => match[1]), ["--request", "--draft", "--convention", "--skip", "--help"]);
});

test("invalid commands and empty requests fail before calling any API", () => {
  const cases: [string[], RegExp][] = [
    [["ticket-scope", "unknown"], /unknown command/],
    [["ticket-scope", "check", "--request", "要求"], /required option/],
    [["ticket-scope", "check", "--request", "要求", "--draft", "本文", "--model", "x"], /unknown option/],
    [["ticket-scope", "check", "--request", "", "--draft", "本文"], /--request must not be empty/],
  ];
  for (const [args, error] of cases) {
    const result = run(args);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, error);
  }
});

test("CLI takes the texts and several skip headings as arguments and writes no files", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "jev-scope-cli-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const draft = "## 変更内容\n\nメモを保存する\n\n## スコープ境界\n\n- 共有\n\n## 完了条件\n\n- `pnpm test`\n";
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
  const args = ["ticket-scope", "check", "--request", "メモを保存できるようにしたい。", "--draft", draft, "--skip", "スコープ境界", "完了条件"];
  const result = run(args, cwd, provider);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "\nFindings\n  implementation-detail L3 p=1.00 メモを保存する\n  unrequested-requirement L3 p=1.00 メモを保存する\n\nBorderline\n  None\n\nErrors: 0\n");
  assert.deepEqual(await readdir(cwd), filesBefore);
});
