import type { QuestionDefinition } from "./questions.js";
import type { Rule } from "./rules.js";

export interface Task {
  check: QuestionDefinition;
  subject: { id: string; label: string; state: string };
}

export function createTasks(questions: QuestionDefinition[], rules: Rule[]): Task[] {
  return questions.flatMap((check) =>
    subjectsFor(check, rules).map((subject) => ({ check, subject })),
  );
}

function area(rule: Rule): "root" | "api" | "web" | "other" {
  if (rule.id === "_root" || rule.globs.includes("**/*")) return "root";
  if (rule.subprojectPath === "api" || rule.globs.includes("api/")) return "api";
  if (rule.subprojectPath === "web" || rule.globs.includes("web/")) return "web";
  return "other";
}

function scopesMayOverlap(left: Rule, right: Rule): boolean {
  const leftArea = area(left);
  const rightArea = area(right);
  return leftArea === "root" || rightArea === "root" || leftArea === rightArea;
}

function ruleState(rule: Rule): string {
  return [
    "# Metadata",
    `id: ${rule.id}`,
    `description: ${rule.description || "(none)"}`,
    `globs: ${rule.globs || "(none)"}`,
    `subprojectPath: ${rule.subprojectPath ?? "(none)"}`,
    "",
    "# Body",
    rule.body,
  ].join("\n");
}

function subjectsFor(check: QuestionDefinition, rules: Rule[]) {
  if (check.subject === "document") {
    return rules.map((rule) => ({ id: rule.id, label: rule.file, state: ruleState(rule) }));
  }
  return rules.flatMap((left, leftIndex) =>
    rules
      .slice(leftIndex + 1)
      .filter((right) => scopesMayOverlap(left, right))
      .map((right) => ({
        id: `${left.id}\u0000${right.id}`,
        label: `${left.file} x ${right.file}`,
        state: `# Rule A\n${ruleState(left)}\n\n# Rule B\n${ruleState(right)}`,
      })),
  );
}
