import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export interface QuestionDefinition {
  id: string;
  // The ticket fits only when every question reaches its own value.
  at: number;
  question: string;
  criteria: { true: string; false: string };
  note: string;
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function requiredString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return value;
}

function probability(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label}.${key} must be between 0 and 1`);
  }
  return value;
}

function parseQuestion(value: unknown, file: string): QuestionDefinition {
  assertObject(value, file);
  const criteria = value.criteria;
  assertObject(criteria, `${file}.criteria`);
  return {
    id: requiredString(value, "id", file),
    at: probability(value, "at", file),
    question: requiredString(value, "question", file),
    criteria: {
      true: requiredString(criteria, "true", `${file}.criteria`),
      false: requiredString(criteria, "false", `${file}.criteria`),
    },
    note: requiredString(value, "note", file),
  };
}

export async function loadQuestions(): Promise<QuestionDefinition[]> {
  const dir = fileURLToPath(new URL("../questions/", import.meta.url));
  const files = (await readdir(dir)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const checks = await Promise.all(
    files.map(async (file) =>
      parseQuestion(parse(await readFile(join(dir, file), "utf8")), file),
    ),
  );
  const ids = new Set<string>();
  for (const check of checks) {
    if (ids.has(check.id)) throw new Error(`duplicate check id: ${check.id}`);
    ids.add(check.id);
  }
  return checks;
}
