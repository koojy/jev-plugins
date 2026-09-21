import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface Rule {
  id: string;
  file: string;
  description: string;
  globs: string;
  subprojectPath: string | null;
  body: string;
}

function frontmatter(text: string): string {
  return text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] ?? "";
}

function frontmatterField(text: string, name: string): string {
  const value = frontmatter(text).match(new RegExp(`^${name}:\\s*(.*)$`, "m"))?.[1];
  return value?.trim() ?? "";
}

export async function loadRules(dir: string): Promise<Rule[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  return Promise.all(
    files.map(async (file): Promise<Rule> => {
      const text = await readFile(join(dir, file), "utf8");
      return {
        id: file.replace(/\.md$/, ""),
        file,
        description: frontmatterField(text, "description"),
        globs: frontmatterField(text, "globs"),
        subprojectPath: frontmatterField(text, "subprojectPath") || null,
        body: text.replace(/^---\n[\s\S]*?\n---(?:\n|$)/, "").trim(),
      };
    }),
  );
}
