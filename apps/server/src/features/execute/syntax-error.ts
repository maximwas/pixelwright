import vm from "node:vm";

/** The name Node gives the compiled code in a SyntaxError's first stack line (`execute:3`). */
const SCRIPT_NAME = "execute";

/** The longest line of the code an error quotes. */
const QUOTED_CHARS = 200;

/**
 * Why code does not parse as the body of execute's async function, or null when it does: the error at the code's own
 * line and column (from the `name:line` and caret lines Node puts on a vm SyntaxError's stack; the wrapper's first
 * line taken off), the line quoted, and when it breaks off at its end, that it may have arrived cut. Only compiled,
 * never run: the plugin runs it.
 */
export function syntaxError(code: string): string | null {
  try {
    void new vm.Script(asFunction(code), { filename: SCRIPT_NAME });

    return null;
  } catch (error) {
    return error instanceof SyntaxError ? placed(error, code) : null;
  }
}

/** The code as the plugin runs it: the body of an async function given figma, console and pw, from the second line. */
export function asFunction(code: string): string {
  return `(async function (figma, console, pw) {\n${code}\n})`;
}

function placed(error: SyntaxError, code: string): string {
  const [header = "", , caret = ""] = (error.stack ?? "").split("\n");
  const at = new RegExp(`^${SCRIPT_NAME}:(\\d+)$`).exec(header);
  const thrown = `${error.name}: ${error.message}`;

  if (at === null) {
    return thrown;
  }

  const lines = code.split("\n");
  const line = Number(at[1]) - 1;
  const column = /^\s*\^+$/.test(caret) ? caret.indexOf("^") + 1 : null;
  const where =
    line > lines.length
      ? ["    at the end of the code"]
      : [
          `    at line ${line}${column === null ? "" : `, column ${column}`}`,
          `line ${line}: ${(lines[line - 1] ?? "").trim().slice(0, QUOTED_CHARS)}`,
        ];

  return [thrown, ...where, ...(line >= lines.length ? [cutNote(code)] : [])].join("\n");
}

function cutNote(code: string): string {
  return `The code ends there, after ${code.length} characters: if you sent more, the rest was cut on its way to Pixelwright (a model's reply is limited in tokens). Keep long code or data in a file and pass its path as script.`;
}
