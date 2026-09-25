import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Experimental_EvaluationMockModelV4 as EvaluationMockModelV4 } from "ai/test";
import { logger } from "../../../src/logger.js";
import { execute } from "../src/execute.js";
import { loadGenreQuestion, parseGenreQuestion } from "../src/questions.js";

// Fixed responses exercise the script, not model accuracy.
function setup(t: TestContext, answer: (questions: unknown) => unknown) {
  const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
  t.after(() => { globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider; });
  const states: string[] = [];
  const model = new EvaluationMockModelV4({ doEvaluate: async ({ state, questions }) => {
    states.push(String(state));
    const answers = answer(questions);
    if (answers instanceof Error) throw answers;
    return { answers: answers as never, warnings: [] };
  } });
  globalThis.AI_SDK_DEFAULT_PROVIDER = {
    evaluationModel(id: string) { assert.equal(id, "typesafe-ai/jev"); return model; },
  } as unknown as typeof previousProvider;
  const stdout: string[] = [];
  const errors: string[] = [];
  t.mock.method(process.stdout, "write", (chunk: string) => { stdout.push(chunk); return true; });
  t.mock.method(logger, "error", (message: string) => { errors.push(message); });
  return { states, stdout, errors };
}

// Jev returns a complete distribution over the genres that sums to 1.
function genreAnswer(given: Record<string, number>) {
  const probabilities = { Feature: 0, Improvement: 0, Bug: 0, Experiment: 0, Norm: 0, Ops: 0, ...given };
  const [choice] = Object.entries(probabilities).sort((left, right) => right[1] - left[1])[0];
  return { genre: { type: "choice", choice, probabilities } };
}

test("the genre is decided when the top genre reaches the threshold and listed by probability", async (t) => {
  const question = await loadGenreQuestion();
  const { states, stdout, errors } = setup(t, (questions) => {
    assert.deepEqual(questions, { genre: {
      type: "choice", instructions: `${question.question}\n\n${question.note}`, criteria: question.criteria,
    } });
    return genreAnswer({ Bug: question.at, Feature: 0.25, Experiment: 0.75 - question.at });
  });
  assert.equal(await execute({ request: "  保存に失敗する\n" }), 0);
  assert.deepEqual(states, ["# Request\n保存に失敗する"]);
  assert.deepEqual(errors, []);
  assert.equal(stdout.join(""), [
    "", "Genres",
    `  Bug p=${question.at.toFixed(2)}`, "  Feature p=0.25", `  Experiment p=${(0.75 - question.at).toFixed(2)}`,
    "  Improvement p=0.00", "  Norm p=0.00", "  Ops p=0.00",
    "", "Decision", "  Bug",
    "", "Errors: 0", "",
  ].join("\n"));
});

test("a top genre below the threshold leaves the decision empty and a failure exits with 3", async (t) => {
  // Subtests also report through stdout, so only the end of the captured output is compared.
  await t.test("undecided", async (st) => {
    const question = await loadGenreQuestion();
    assert.ok(question.at > 0.5);
    const { stdout } = setup(st, () => genreAnswer({ Feature: 0.5, Improvement: 0.25, Bug: 0.25 }));
    assert.equal(await execute({ request: "検索を速くしたい" }), 0);
    assert.match(stdout.join(""), /\n {2}Feature p=0\.50\n[\s\S]*\nDecision\n {2}None\n\nErrors: 0\n$/);
  });
  await t.test("failed", async (st) => {
    const { stdout, errors } = setup(st, () => new Error("unavailable"));
    assert.equal(await execute({ request: "検索を速くしたい" }), 3);
    assert.match(stdout.join(""), /\nGenres\n {2}None\n\nDecision\n {2}None\n\nErrors: 1\n$/);
    assert.match(errors[0], /^genre: .*unavailable/);
  });
  await t.test("no probabilities", async (st) => {
    const { errors } = setup(st, () => ({ genre: { type: "choice", choice: "Bug" } }));
    assert.equal(await execute({ request: "検索を速くしたい" }), 3);
    assert.match(errors[0], /no probabilities/);
  });
});

test("an empty request and invalid genre definitions fail before any evaluation", async (t) => {
  const { states } = setup(t, () => new Error("must not be called"));
  await assert.rejects(execute({ request: " \n" }), /--request must not be empty/);
  assert.equal(states.length, 0);
  assert.throws(() => parseGenreQuestion({ id: "g", at: 0.6, question: "q", note: "n", criteria: { Bug: "b" } }, "g.yml"),
    /g\.yml\.criteria must list at least two genres/);
  assert.throws(() => parseGenreQuestion({ id: "g", at: 1.5, question: "q", note: "n", criteria: { Bug: "b", Ops: "o" } }, "g.yml"),
    /g\.yml\.at must be between 0 and 1/);
});
