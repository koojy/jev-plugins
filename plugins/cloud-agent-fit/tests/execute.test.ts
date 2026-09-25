import assert from "node:assert/strict";
import test from "node:test";
import { Experimental_EvaluationMockModelV4 as EvaluationMockModelV4 } from "ai/test";
import { logger } from "../../../src/logger.js";
import { execute } from "../src/execute.js";
import { loadQuestions } from "../src/questions.js";

// Fixed responses exercise the script, not model accuracy.
test("Cloud Agent is decided only when every question reaches its threshold", async (t) => {
  const checks = await loadQuestions();
  assert.deepEqual(checks.map((check) => check.id), ["autonomous", "convergent"]);
  const byInstructions = (instructions: string) => checks.find((check) => `${check.question}\n\n${check.note}` === instructions)!;
  const cases: [string, (id: string, at: number) => number | Error, number, RegExp][] = [
    ["all pass", (_, at) => at, 0, /\nChecks\n {2}autonomous p=0\.70 at=0\.70\n {2}convergent p=0\.70 at=0\.70\n\nDecision\n {2}Cloud Agent\n\nErrors: 0\n$/],
    ["one below", (id, at) => id === "convergent" ? at - 0.01 : 0.99, 0, /\n {2}convergent p=0\.69 at=0\.70\n\nDecision\n {2}None\n/],
    ["one failed", (id) => id === "autonomous" ? new Error("unavailable") : 0.99, 3, /\nChecks\n {2}convergent p=0\.99 at=0\.70\n\nDecision\n {2}None\n\nErrors: 1\n$/],
  ];
  // Each case runs as a subtest so its mocks are restored before the next one is installed.
  // Subtests also report through stdout, so only the end of the captured output is compared.
  for (const [name, probability, code, output] of cases) {
    await t.test(name, async (st) => {
      const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
      st.after(() => { globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider; });
      const states: string[] = [];
      const model = new EvaluationMockModelV4({ doEvaluate: async ({ state, questions }) => {
        states.push(String(state));
        const { verdict } = questions as { verdict: { type: string; instructions: string; criteria: unknown } };
        const check = byInstructions(verdict.instructions);
        assert.deepEqual(verdict, { type: "boolean", instructions: verdict.instructions, criteria: check.criteria });
        const result = probability(check.id, check.at);
        if (result instanceof Error) throw result;
        return { answers: { verdict: { type: "boolean", probability: result } }, warnings: [] };
      } });
      globalThis.AI_SDK_DEFAULT_PROVIDER = {
        evaluationModel(id: string) { assert.equal(id, "typesafe-ai/jev"); return model; },
      } as unknown as typeof previousProvider;
      const stdout: string[] = [];
      const errors: string[] = [];
      st.mock.method(process.stdout, "write", (chunk: string) => { stdout.push(chunk); return true; });
      st.mock.method(logger, "error", (message: string) => { errors.push(message); });

      assert.equal(await execute({ draft: "## 変更内容\n文言を変える\n" }), code);
      assert.deepEqual(states, ["# Ticket\n## 変更内容\n文言を変える", "# Ticket\n## 変更内容\n文言を変える"]);
      assert.match(stdout.join(""), output);
      if (code === 3) assert.match(errors[0], /^autonomous: .*unavailable/);
    });
  }
});

test("an empty draft fails before any evaluation", async () => {
  await assert.rejects(execute({ draft: "" }), /--draft must not be empty/);
});
