import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export interface GenreQuestion {
  id: string;
  // The top genre is decided only when its probability reaches this value.
  at: number;
  question: string;
  // Genre label names mapped to their definitions; the model picks one.
  criteria: Record<string, string>;
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

export function parseGenreQuestion(value: unknown, file: string): GenreQuestion {
  assertObject(value, file);
  const criteria = value.criteria;
  assertObject(criteria, `${file}.criteria`);
  const genres = Object.keys(criteria);
  if (genres.length < 2) throw new Error(`${file}.criteria must list at least two genres`);
  return {
    id: requiredString(value, "id", file),
    at: probability(value, "at", file),
    question: requiredString(value, "question", file),
    criteria: Object.fromEntries(genres.map((genre) => [genre, requiredString(criteria, genre, `${file}.criteria`)])),
    note: requiredString(value, "note", file),
  };
}

export async function loadGenreQuestion(): Promise<GenreQuestion> {
  const file = fileURLToPath(new URL("../questions/genre.yml", import.meta.url));
  return parseGenreQuestion(parse(await readFile(file, "utf8")), "genre.yml");
}
