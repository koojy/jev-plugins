import assert from "node:assert/strict";
import test from "node:test";
import { parseDraft } from "../src/draft.js";

test("paragraphs and top-level list items become items under their headings", () => {
  const draft = [
    "対象リポジトリ: `owner/repo`。**PRは`develop`へ**。", // 1
    "", // 2
    "## 承認済みシナリオ", // 3
    "", // 4
    "前提: ログイン済みのユーザーがいる", // 5
    "1. 保存ボタンを押すと「保存しました」と表示される", // 6
    "   - 表示は3秒で消える", // 7
    "", // 8
    "   続けて一覧へ戻る", // 9
    "2. 二重送信しても1件だけ保存される", // 10
    "続きの行", // 11
    "", // 12
    "### 異常系 ###", // 13
    "", // 14
    "- 通信に失敗したら再試行ボタンを出す", // 15
    "", // 16
    "---", // 17
    "", // 18
    "## 決定事項", // 19
    "", // 20
    "| 項目 | 値 |", // 21
    "| --- | --- |", // 22
    "| 上限 | 10件 |", // 23
    "本文ここまで", // 24
  ].join("\n");
  assert.deepEqual(parseDraft(draft), [
    { line: 1, headings: [], text: "対象リポジトリ: `owner/repo`。**PRは`develop`へ**。" },
    { line: 5, headings: ["承認済みシナリオ"], text: "前提: ログイン済みのユーザーがいる" },
    {
      line: 6,
      headings: ["承認済みシナリオ"],
      text: "1. 保存ボタンを押すと「保存しました」と表示される\n   - 表示は3秒で消える\n\n   続けて一覧へ戻る",
    },
    { line: 10, headings: ["承認済みシナリオ"], text: "2. 二重送信しても1件だけ保存される\n続きの行" },
    { line: 15, headings: ["承認済みシナリオ", "異常系"], text: "- 通信に失敗したら再試行ボタンを出す" },
    { line: 21, headings: ["決定事項"], text: "| 項目 | 値 |\n| --- | --- |\n| 上限 | 10件 |\n本文ここまで" },
  ]);
});

test("code blocks stay with their item and hide headings and blank lines inside them", () => {
  const draft = [
    "## 変更内容", // 1
    "文言を次に変える", // 2
    "````text", // 3
    "# 見出しではない", // 4
    "", // 5
    "```", // 6
    "保存しました", // 7
    "```", // 8
    "````", // 9
    "", // 10
    "~~~", // 11
    "独立したブロック", // 12
    "~~~", // 13
    "## 完了条件", // 14
    "- `pnpm test`", // 15
  ].join("\r\n");
  assert.deepEqual(parseDraft(draft), [
    { line: 2, headings: ["変更内容"], text: "文言を次に変える\n````text\n# 見出しではない\n\n```\n保存しました\n```\n````" },
    { line: 11, headings: ["変更内容"], text: "~~~\n独立したブロック\n~~~" },
    { line: 15, headings: ["完了条件"], text: "- `pnpm test`" },
  ]);
});

test("a same-level heading replaces the previous one and a draft without items yields none", () => {
  const draft = "# Ticket\n## A\ntext a\n## B\n#hashtag\n";
  assert.deepEqual(parseDraft(draft), [
    { line: 3, headings: ["Ticket", "A"], text: "text a" },
    { line: 5, headings: ["Ticket", "B"], text: "#hashtag" },
  ]);
  assert.deepEqual(parseDraft("## 見出しだけ\n\n***\n"), []);
});
