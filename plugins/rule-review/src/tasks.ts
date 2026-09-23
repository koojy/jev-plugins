import type { QuestionDefinition } from "./questions.js";
import type { Rule } from "./rules.js";

export interface Task {
  check: QuestionDefinition;
  subject: { id: string; label: string; state: string };
}

// Without targets every rule and pair is checked; with targets only those rules and pairs including one.
export function createTasks(questions: QuestionDefinition[], rules: Rule[], targets?: ReadonlySet<string>): Task[] {
  const isTarget = (rule: Rule) => !targets || targets.has(rule.file);
  return questions.flatMap((check) =>
    subjectsFor(check, rules, isTarget).map((subject) => ({ check, subject })),
  );
}

function ruleState(rule: Rule): string {
  return [
    "# Metadata",
    `id: ${rule.id}`,
    `description: ${rule.description || "(none)"}`,
    `globs: ${rule.globs.length ? JSON.stringify(rule.globs) : "(none)"}`,
    `subprojectPath: ${rule.subprojectPath ?? "(none)"}`,
    "",
    "# Body",
    rule.body,
  ].join("\n");
}

function subjectsFor(check: QuestionDefinition, rules: Rule[], isTarget: (rule: Rule) => boolean) {
  if (check.subject === "document") {
    return rules.filter(isTarget).map((rule) => ({ id: rule.id, label: rule.file, state: ruleState(rule) }));
  }
  return rules.flatMap((left, leftIndex) =>
    rules
      .slice(leftIndex + 1)
      .filter((right) => isTarget(left) || isTarget(right))
      .map((right) => ({
        id: `${left.id}\u0000${right.id}`,
        label: `${left.file} x ${right.file}`,
        state: `# Rule A\n${ruleState(left)}\n\n# Rule B\n${ruleState(right)}`,
      })),
  );
}
