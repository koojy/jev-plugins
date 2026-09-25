export interface DraftItem {
  // 1-based line of the item's first line in the draft.
  line: number;
  // Headings enclosing the item, outermost first; empty before the first heading.
  headings: string[];
  text: string;
}

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_ITEM = /^(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;

// Each paragraph and each top-level list item is one item; nested lists and code blocks stay with their item.
export function parseDraft(text: string): DraftItem[] {
  const items: DraftItem[] = [];
  const headings: { level: number; text: string }[] = [];
  let current: { line: number; headings: string[]; lines: string[]; list: boolean } | null = null;
  let fence: string | null = null;
  let blank = false;
  const close = () => {
    if (current) items.push({ line: current.line, headings: current.headings, text: current.lines.join("\n").trim() });
    current = null;
  };
  const open = (line: number, content: string, list: boolean) => {
    close();
    current = { line, headings: headings.map((heading) => heading.text), lines: [content], list };
  };

  text.split(/\r?\n/).forEach((content, index) => {
    const line = index + 1;
    if (fence !== null) {
      current!.lines.push(content);
      const closing = FENCE.exec(content);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length && content.trim() === closing[1]) fence = null;
      return;
    }
    if (content.trim() === "") {
      if (current && !current.list) close();
      current?.lines.push("");
      blank = true;
      return;
    }
    const indented = /^[ \t]/.test(content);
    const heading = HEADING.exec(content);
    const opening = FENCE.exec(content);
    if (heading) {
      close();
      const level = heading[1].length;
      while (headings.length && headings.at(-1)!.level >= level) headings.pop();
      headings.push({ level, text: heading[2] ?? "" });
    } else if (THEMATIC_BREAK.test(content)) {
      close();
    } else if (!indented && LIST_ITEM.test(content)) {
      open(line, content, true);
    } else if (current && (!blank || (current.list && indented))) {
      current.lines.push(content);
    } else {
      open(line, content, false);
    }
    if (opening && !heading) fence = opening[1];
    blank = false;
  });
  close();
  return items;
}
