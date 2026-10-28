import { createHash } from "node:crypto";
import { NAME_HASHES } from "./names-in.constants.ts";

const CAMEL_HUMP = /(\p{Ll})(\p{Lu})/gu;
const NOT_A_LETTER = /[^\p{L}]+/u;

/** The words of `text` (camelCase split apart) that are on the names list, with their 1-based line numbers. */
export function namesIn(text: string): { line: number; word: string }[] {
  const found: { line: number; word: string }[] = [];

  for (const [index, line] of text.split("\n").entries()) {
    for (const word of line.replace(CAMEL_HUMP, "$1 $2").split(NOT_A_LETTER)) {
      const hash = createHash("sha256").update(word.toLowerCase()).digest("hex");

      if (NAME_HASHES.has(hash)) {
        found.push({ line: index + 1, word });
      }
    }
  }

  return found;
}
