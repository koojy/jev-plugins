import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { Experimental_EvaluationMockModelV4 as EvaluationMockModelV4 } from "ai/test";
import { logger } from "../../../src/logger.js";
import { execute } from "../src/execute.js";
import { loadQuestions } from "../src/questions.js";

// Fixed responses exercise the script, not model accuracy.
test("checks use fixed settings, classify responses, continue after errors and never cache", async (t) => {
  const rules = await mkdtemp(join(tmpdir(), "jev-check-"));
  const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
  t.after(async () => {
    globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider;
    await rm(rules, { recursive: true, force: true });
  });
  // Different scopes must not exclude pairs, including formerly special-cased names.
  for (const [id, scope] of [["a", "api"], ["b", "web"], ["c", "worker"], ["d", "docs"]]) {
    await writeFile(join(rules, `${id}.md`), `---\nsubprojectPath: ${scope}\nglobs: ${scope}/**\n---\n${id}`);
  }
  const definitions = await loadQuestions();
  let active = 0, maxActive = 0, requests = 0, fail = true;
  const model = new EvaluationMockModelV4({ doEvaluate: async ({ state, questions }) => {
    const definition = definitions.find((item) => `${item.question}\n\n${item.note}` === questions.verdict.instructions)!;
    assert.ok(definition);
    assert.deepEqual(questions, { verdict: {
      type: "boolean", instructions: `${definition.question}\n\n${definition.note}`, criteria: definition.criteria,
    } });
    const id = /\nid: (\w+)\n/.exec(String(state))![1];
    requests++;
    maxActive = Math.max(maxActive, ++active);
    await delay(id === "a" ? 15 : 5);
    active--;
    if (id === "c" && definition.subject === "document" && fail) throw new Error("unavailable");
    return {
      answers: { verdict: { type: "boolean", probability: id === "a" ? definition.at : id === "b" ? definition.loose : 0 } },
      warnings: [],
    };
  } });
  globalThis.AI_SDK_DEFAULT_PROVIDER = {
    evaluationModel(id: string) { assert.equal(id, "typesafe-ai/jev"); return model; },
  } as unknown as typeof previousProvider;
  const logs: string[] = [], errors: string[] = [];
  t.mock.method(process.stdout, "write", (chunk: string) => { logs.push(...chunk.split("\n")); return true; });
  t.mock.method(logger, "error", (...args: unknown[]) => errors.push(args.join(" ")));

  assert.equal(await execute(rules), 3);
  assert.equal(maxActive, 4);
  assert.equal(requests, 18); // 3 document questions × 4 files + 6 rule pairs.
  const findings = logs.slice(logs.indexOf("Findings") + 1, logs.indexOf("Borderline"));
  const loose = logs.slice(logs.indexOf("Borderline") + 1);
  for (const definition of definitions.filter((item) => item.subject === "document")) {
    assert.ok(findings.includes(`  ${definition.id} a.md p=${definition.at.toFixed(2)}`));
    assert.ok(loose.includes(`  ${definition.id} b.md p=${definition.loose.toFixed(2)}`));
    assert.ok(errors.includes(`${definition.id} c.md: unavailable`));
    assert.ok(!logs.some((line) => line.startsWith(`  ${definition.id} d.md p=`)));
  }
  assert.ok(logs.includes("Errors: 3"));
  fail = false;
  requests = 0;
  logs.length = errors.length = 0;
  assert.equal(await execute(rules), 0);
  assert.equal(requests, 18);
  assert.equal(errors.length, 0);
  assert.deepEqual((await readdir(rules)).sort(), ["a.md", "b.md", "c.md", "d.md"]);
});

test("targets limit document checks to targets and pairs to those including a target", async (t) => {
  const rules = await mkdtemp(join(tmpdir(), "jev-target-"));
  const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
  t.after(async () => {
    globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider;
    await rm(rules, { recursive: true, force: true });
  });
  for (const id of ["a", "b", "c", "d"]) await writeFile(join(rules, `${id}.md`), id);
  const subjects: string[] = [];
  const model = new EvaluationMockModelV4({ doEvaluate: async ({ state }) => {
    subjects.push([...String(state).matchAll(/\nid: (\w+)\n/g)].map((match) => match[1]).join(""));
    return { answers: { verdict: { type: "boolean", probability: 0 } }, warnings: [] };
  } });
  globalThis.AI_SDK_DEFAULT_PROVIDER = {
    evaluationModel: () => model,
  } as unknown as typeof previousProvider;
  t.mock.method(process.stdout, "write", () => true);

  // Paths resolve by file name, so callers can pass paths relative to their own directory.
  assert.equal(await execute(rules, [join("agents", "rules", "b.md"), "d.md"]), 0);
  assert.deepEqual(
    [...new Set(subjects)].sort(),
    ["ab", "b", "bc", "bd", "ad", "cd", "d"].sort(),
  );
  assert.equal(subjects.length, 3 * 2 + 5); // 3 document questions × 2 targets + 5 pairs.
  await assert.rejects(execute(rules, ["missing.md"]), /Target rules not found in .*: missing\.md/);
});
