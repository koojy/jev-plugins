import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadQuestions } from "../src/questions.js";
import { loadRules } from "../src/rules.js";
import { createTasks } from "../src/tasks.js";

test("YAML descriptions and glob lists reach evaluation tasks without losing content", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "jev-rule-metadata-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cases = [
    { id: "folded", metadata: 'description: >-\n  First line\n  second line\nglobs:\n  - "src/**"\n  - "tests/**"', description: "First line second line", globs: ["src/**", "tests/**"] },
    { id: "literal", metadata: 'description: |-\n  First line\n  second line\nglobs: ["src/**", "tests/**"]', description: "First line\nsecond line", globs: ["src/**", "tests/**"] },
    { id: "scalar", metadata: 'description: "Quoted description"\nglobs: "src/**"\nsubprojectPath: "package"', description: "Quoted description", globs: ["src/**"] },
    { id: "crlf", metadata: 'description: >-\n  First line\n  second line\nglobs: ["src/**", "tests/**"]', description: "First line second line", globs: ["src/**", "tests/**"] },
    { id: "empty", metadata: "", description: "", globs: [] },
    { id: "plain", metadata: null, description: "", globs: [] },
  ];
  for (const item of cases) {
    const body = "# Rule\nKeep all metadata.\n";
    const text = item.metadata === null ? body : `---\n${item.metadata}\n---\n${body}`;
    await writeFile(join(dir, `${item.id}.md`), item.id === "crlf" ? text.replaceAll("\n", "\r\n") : text);
  }
  const rules = await loadRules(dir);
  const questions = await loadQuestions();
  const tasks = createTasks(questions, rules);
  for (const item of cases) {
    const rule = rules.find((rule) => rule.id === item.id)!;
    assert.equal(rule.description, item.description, item.id);
    assert.deepEqual(rule.globs, item.globs, item.id);
    assert.equal(rule.subprojectPath, item.id === "scalar" ? "package" : null);
    assert.equal(rule.body.replaceAll("\r\n", "\n"), "# Rule\nKeep all metadata.");
    const task = tasks.find((task) => task.check.subject === "document" && task.subject.id === item.id)!;
    assert.ok(task.subject.state.includes(`description: ${item.description || "(none)"}`));
    assert.ok(task.subject.state.includes(`globs: ${item.globs.length ? JSON.stringify(item.globs) : "(none)"}`));
    assert.ok(task.subject.state.includes(rule.body));
  }
  const pair = tasks.find((task) => task.check.subject === "pair" && task.subject.label === "folded.md x literal.md")!;
  assert.ok(pair.subject.state.includes("First line second line"));
  assert.ok(pair.subject.state.includes("First line\nsecond line"));
});

test("invalid YAML metadata is rejected instead of silently losing values", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "jev-rule-invalid-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const metadata of ["description: [unfinished", "- item", "description: [text]", "globs: [src/**, 42]", "globs: {path: src}", "subprojectPath: [package]"]) {
    await writeFile(join(dir, "invalid.md"), `---\n${metadata}\n---\n# Rule`);
    await assert.rejects(loadRules(dir), /invalid\.md/);
  }
});
