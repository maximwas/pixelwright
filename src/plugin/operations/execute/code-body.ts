import type { CodeValue } from "@/plugin/operations/execute/code-value.ts";
import {
  ASYNC_FORMS,
  ASYNC_HINT,
  CODE_OUTPUT,
  CODE_PARAMS,
  CODE_PRINT,
  CODE_PROBE,
  CODE_STACK,
  CODE_TEXT,
} from "@/plugin/operations/execute/execute.constants.ts";

type CodeFunction = (...values: unknown[]) => Promise<unknown>;

type AsyncBody = new (...names: string[]) => CodeFunction;

/** One line of a stack: the function, the script it ran in and the place there. */
interface Frame {
  readonly name: string;
  readonly site: string;
  readonly line: number;
  readonly column: number | undefined;
}

/**
 * Code as the body of an async function given figma, console and pw (T-150), and what it threw, told at the code's
 * own lines. Every function comes from this one place, so the frames of any code name the same site, and a probe's
 * frame tells where the engine's wrapper puts the first line.
 */
export class CodeBody {
  readonly #values: CodeValue;
  readonly #asyncFunction: AsyncBody = Object.getPrototypeOf(async () => undefined).constructor;

  constructor(values: CodeValue) {
    this.#values = values;
  }

  compiled(code: string): CodeFunction {
    return new this.#asyncFunction(...CODE_PARAMS, code);
  }

  /**
   * What code threw: an Error as its name and message, the frames of the code itself, the line it threw on, and the
   * async call to make when Figma refused a synchronous one; a thrown object by its message, anything else as console
   * prints it (D-68).
   */
  async explained(error: unknown, code: string): Promise<string> {
    if (!(error instanceof Error)) {
      return this.#thrownValue(error);
    }

    const probe = await this.#probe();
    const frames = probe === null ? [] : this.#codeFrames(error.stack ?? "", probe);
    const first = frames[0];
    const quoted =
      first === undefined
        ? ""
        : (code.split(CODE_PRINT.lineBreak)[first.line - 1]?.trim().slice(0, CODE_OUTPUT.quotedChars) ?? "");
    const hint = this.#asyncHint(error.message, quoted);

    return [
      CODE_TEXT.thrown(error.name, error.message),
      ...frames.map((frame) => this.#framed(frame)),
      ...(first === undefined ? [] : [CODE_TEXT.quoted(first.line, quoted)]),
      ...(hint === null ? [] : [hint]),
    ].join(CODE_PRINT.lineBreak);
  }

  #thrownValue(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
      return error.message;
    }

    return this.#values.printed(error);
  }

  async #probe(): Promise<Frame | null> {
    try {
      await this.compiled(CODE_PROBE)();
    } catch (error) {
      return error instanceof Error ? (this.#frames(error.stack ?? "")[0] ?? null) : null;
    }

    return null;
  }

  /** The frames of an error's stack in the code, at the code's own lines and columns, the code's top level unnamed. */
  #codeFrames(stack: string, probe: Frame): Frame[] {
    return this.#frames(stack)
      .filter((frame) => frame.site === probe.site)
      .slice(0, CODE_OUTPUT.frames)
      .map((frame) => ({
        ...frame,
        name: this.#unasync(frame.name) === this.#unasync(probe.name) ? "" : frame.name,
        // The engines start the body on a line of its own, so its columns are the code's; which token of a throwing
        // expression a column points at differs (V8 the probe's `new`, QuickJS its call).
        line: frame.line - probe.line + 1,
      }));
  }

  /** The stack's lines that name a place; the rest (native frames) left out. */
  #frames(stack: string): Frame[] {
    return stack.split(CODE_PRINT.lineBreak).flatMap((text) => {
      const match = CODE_STACK.frame.exec(text);

      return match === null
        ? []
        : [
          {
            name: match[1] ?? "",
            site: match[2] ?? "",
            line: Number(match[3]),
            column: match[4] === undefined ? undefined : Number(match[4]),
          },
        ];
    });
  }

  #framed({ name, line, column }: Frame): string {
    const place = CODE_TEXT.place(line, column);

    return name === "" ? CODE_TEXT.at(place) : CODE_TEXT.atNamed(name, place);
  }

  #unasync(name: string): string {
    return name.replace(CODE_STACK.asyncName, "");
  }

  /**
   * The async call to make instead (T-155), when Figma refused a synchronous one for dynamic-page without naming it:
   * the API found by name in Figma's message, else in the code's line that threw.
   */
  #asyncHint(message: string, line: string): string | null {
    if (!message.includes(ASYNC_HINT.dynamicPage) || message.includes(ASYNC_HINT.asyncForm)) {
      return null;
    }

    const named = (text: string) => Object.keys(ASYNC_FORMS).find((name) => ASYNC_HINT.word(name).test(text));
    const name = named(message) ?? named(line);

    return name === undefined ? ASYNC_HINT.any : ASYNC_HINT.named(ASYNC_FORMS[name] ?? name);
  }
}
