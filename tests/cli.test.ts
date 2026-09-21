import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const entry = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
function run(args: string[]) {
  const env = { ...process.env };
  delete env.AI_GATEWAY_API_KEY;
  const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), entry, ...args], { env, encoding: "utf8", timeout: 15_000 });
  assert.ifError(result.error);
  return result;
}

test("root help lists registered plugins without API credentials", () => {
  for (const args of [[], ["--help"]]) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /^\s+rule-review\s/m);
  }
});

test("unknown root commands fail before execution", () => {
  const result = run(["unknown"]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /unknown command/);
});
