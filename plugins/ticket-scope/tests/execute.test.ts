import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test, { type TestContext } from "node:test";
import { Experimental_EvaluationMockModelV4 as EvaluationMockModelV4 } from "ai/test";
import { logger } from "../../../src/logger.js";
import { execute } from "../src/execute.js";
import { loadQuestions } from "../src/questions.js";

const request = `メモを保存できるようにしたい。
Q: 保存後にどこへ戻る？ A: 一覧へ戻る。
`;

const draft = `対象リポジトリ: \`owner/repo\`。**PRは\`develop\`へ**。

## ユーザーストーリー

ユーザーとして、メモを保存して後から見返したい。

## 承認済みシナリオ

1. 保存ボタンを押すとメモが保存され、一覧へ戻る
2. 保存に失敗したら「保存できませんでした」と3秒表示する
3. 本文が空なら保存ボタンを押せない

## 決定事項

- 保存後は一覧へ戻る

## 完了条件

- \`pnpm test\`
`;

// Fixed responses exercise the script, not model accuracy. `answer` gives the probability for the item containing a text.
async function setup(t: TestContext, answer: (state: string) => number) {
  const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
  t.after(() => { globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider; });
  const [definition] = await loadQuestions();
  const states: string[] = [];
  const model = new EvaluationMockModelV4({ doEvaluate: async ({ state, questions }) => {
    states.push(String(state));
    assert.deepEqual(questions, { verdict: {
      type: "boolean", instructions: `${definition.question}\n\n${definition.note}`, criteria: definition.criteria,
    } });
    // Earlier items answer later, so the report order cannot follow completion order.
    await delay(Math.max(0, 20 - states.length * 3));
    const probability = answer(String(state));
    if (Number.isNaN(probability)) throw new Error("unavailable");
    return { answers: { verdict: { type: "boolean", probability } }, warnings: [] };
  } });
  globalThis.AI_SDK_DEFAULT_PROVIDER = {
    evaluationModel(id: string) { assert.equal(id, "typesafe-ai/jev"); return model; },
  } as unknown as typeof previousProvider;
  const stdout: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  t.mock.method(process.stdout, "write", (chunk: string) => { stdout.push(chunk); return true; });
  t.mock.method(logger, "warn", (message: string) => { warnings.push(message); });
  t.mock.method(logger, "error", (message: string) => { errors.push(message); });
  return { definition, states, stdout, warnings, errors };
}

test("each item outside skipped headings is checked against the request and reported in draft order", async (t) => {
  const { definition, states, stdout, warnings, errors } = await setup(t, (state) =>
    state.includes("3秒") ? definition.at : state.includes("本文が空") ? definition.loose : definition.loose - 0.01);
  assert.equal(await execute({ request, draft, skip: ["完了条件", "スコープ境界"] }), 0);
  assert.equal(states.length, 6);
  assert.ok(states.every((state) => state.startsWith(`# Request and answers\n${request.trim()}\n\n# Draft item\nsection: `)));
  assert.ok(states.includes(`# Request and answers\n${request.trim()}\n\n# Draft item\nsection: (none)\n\n対象リポジトリ: \`owner/repo\`。**PRは\`develop\`へ**。`));
  assert.ok(states.includes(`# Request and answers\n${request.trim()}\n\n# Draft item\nsection: 承認済みシナリオ\n\n3. 本文が空なら保存ボタンを押せない`));
  assert.ok(!states.some((state) => state.includes("pnpm test")));
  assert.deepEqual(warnings, ["No items under a heading that starts with: スコープ境界"]);
  assert.deepEqual(errors, []);
  assert.equal(stdout.join(""), [
    "", "Findings", "  unrequested-requirement L10 p=0.70 2. 保存に失敗したら「保存できませんでした」と3秒表示する",
    "", "Borderline", "  unrequested-requirement L11 p=0.50 3. 本文が空なら保存ボタンを押せない",
    "", "Errors: 0", "",
  ].join("\n"));
});

test("conventions are sent between the request and the item, so completion conditions can be checked too", async (t) => {
  const { states, errors } = await setup(t, () => 0);
  const convention = "完了条件には pnpm test を書く。\n";
  assert.equal(await execute({ request, draft, convention }), 0);
  assert.equal(states.length, 7);
  assert.ok(states.includes(`# Request and answers\n${request.trim()}\n\n# Conventions\n完了条件には pnpm test を書く。\n\n# Draft item\nsection: 完了条件\n\n- \`pnpm test\``));
  assert.ok(states.every((state) => state.includes("\n\n# Conventions\n完了条件には pnpm test を書く。\n\n# Draft item\n")));
  assert.deepEqual(errors, []);
});

test("failed evaluations are reported with their location and exit with 3", async (t) => {
  const { stdout, errors } = await setup(t, (state) =>
    state.endsWith("一覧へ戻る") ? Number.NaN : 0);
  assert.equal(await execute({ request, draft }), 3);
  assert.match(stdout.join(""), /Errors: 2\n$/);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^unrequested-requirement L9: .*unavailable/);
  assert.match(errors[1], /^unrequested-requirement L15: .*unavailable/);
});

test("invalid inputs fail before any evaluation", async (t) => {
  const cases: [Parameters<typeof execute>[0], RegExp][] = [
    [{ request: " \n", draft }, /--request must not be empty/],
    [{ request, draft, skip: [""] }, /--skip headings must not be empty/],
    [{ request, draft, convention: " \n" }, /--convention must not be empty/],
  ];
  // Each case runs as a subtest so its mocks are restored before the next one is installed.
  for (const [options, error] of cases) {
    await t.test(error.source, async (st) => {
      const { states } = await setup(st, () => 0);
      await assert.rejects(execute(options), error);
      assert.equal(states.length, 0);
    });
  }
});

test("a draft with nothing left to check exits with 2", async (t) => {
  const cases: [string, Parameters<typeof execute>[0]][] = [
    ["no items", { request, draft: "## 見出しだけ\n" }],
    ["all skipped", { request, draft: "## 完了条件\n\n- `pnpm test`\n", skip: ["完了"] }],
  ];
  for (const [name, options] of cases) {
    await t.test(name, async (st) => {
      const { states, stdout, errors } = await setup(st, () => 0);
      assert.equal(await execute(options), 2);
      assert.equal(states.length, 0);
      assert.deepEqual(stdout, []);
      assert.deepEqual(errors, ["No draft items to check. Nothing was checked."]);
    });
  }
});
