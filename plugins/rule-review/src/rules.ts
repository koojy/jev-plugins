import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

export interface Rule {
  id: string;
  file: string;
  description: string;
  globs: string[];
  subprojectPath: string | null;
  body: string;
}

function optionalString(value: unknown, field: string): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

export async function loadRules(dir: string): Promise<Rule[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  return Promise.all(
    files.map(async (file): Promise<Rule> => {
      const text = await readFile(join(dir, file), "utf8");
      const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      try {
        const metadata = frontmatter ? parse(frontmatter[1]) ?? {} : {};
        if (typeof metadata !== "object" || Array.isArray(metadata)) {
          throw new Error("frontmatter must be a mapping");
        }
        const globs: unknown = typeof metadata.globs === "string" ? [metadata.globs] : metadata.globs ?? [];
        if (!Array.isArray(globs) || !globs.every((glob) => typeof glob === "string")) {
          throw new Error("globs must be a string or an array of strings");
        }
        return {
          id: file.replace(/\.md$/, ""),
          file,
          description: optionalString(metadata.description, "description"),
          globs,
          subprojectPath: optionalString(metadata.subprojectPath, "subprojectPath") || null,
          body: text.slice(frontmatter?.[0].length ?? 0).trim(),
        };
      } catch (error) {
        throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }),
  );
}
