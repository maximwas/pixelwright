import { Script } from "node:vm";
import { CODE_WRAPPER, SYNTAX } from "@/server/tools/execute/execute.constants.ts";

/**
 * Why code does not parse as the body of execute's async function, or null when it does (T-152): the error at the
 * code's own line and column (from the `name:line` and caret lines Node puts on a vm SyntaxError's stack, the
 * wrapper's first line taken off), the line quoted, and when it breaks off at its end, that it may have arrived cut
 * (B-006). Only compiled, never run: the plugin runs it.
 */
export class SyntaxCheck {
  problem(code: string): string | null {
    try {
      void new Script(CODE_WRAPPER.wrapped(code), { filename: SYNTAX.scriptName });

      return null;
    } catch (error) {
      return error instanceof SyntaxError ? this.#placed(error, code) : null;
    }
  }

  #placed(error: SyntaxError, code: string): string {
    const [header = "", , caret = ""] = (error.stack ?? "").split(SYNTAX.lineBreak);
    const at = SYNTAX.header.exec(header);
    const thrown = SYNTAX.thrown(error.name, error.message);

    if (at === null) {
      return thrown;
    }

    const lines = code.split(SYNTAX.lineBreak);
    const line = Number(at[1]) - CODE_WRAPPER.linesBefore;
    const column = SYNTAX.caret.test(caret) ? caret.indexOf(SYNTAX.caretMark) + 1 : null;
    const where =
      line > lines.length
        ? [SYNTAX.atEnd]
        : [SYNTAX.at(line, column), SYNTAX.quoted(line, (lines[line - 1] ?? "").trim().slice(0, SYNTAX.quotedChars))];

    return [thrown, ...where, ...(line >= lines.length ? [SYNTAX.cut(code.length)] : [])].join(SYNTAX.lineBreak);
  }
}
