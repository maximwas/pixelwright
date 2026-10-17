import {
  EXECUTE_LOG_CHARS,
  EXECUTE_MAX_LOGS,
  EXECUTE_RESULT_CHARS,
  type OperationInput,
  type OperationOutput,
} from "@pixelwright/core";
import type { CodeScope } from "../../services/code-scope.ts";
import type { EditsGuard } from "../../services/edits-guard.ts";
import { codeHelpers } from "./code-helpers.ts";
import { jsonValue } from "./json-value.ts";

type AsyncBody = new (...names: string[]) => (...values: unknown[]) => Promise<unknown>;

/** The constructor of async functions: the code becomes the body of one. */
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as AsyncBody;

/** What the race gives when the timer wins. */
const TIMED_OUT = Symbol("timed out");

/**
 * Code as the body of an async function, given figma, a console that keeps what it prints and pw (Pixelwright's
 * helpers, and what earlier calls kept there): its value made JSON-safe, or what it threw, or that it ran past its
 * time (it may still be running: a plugin cannot stop it). Whatever it changed is one undo step. Refused while Allow
 * edits is off.
 */
export async function execute(
  { code, timeoutMs }: OperationInput<"execute">,
  { edits, code: scope }: { readonly edits: EditsGuard; readonly code: CodeScope },
): Promise<OperationOutput<"execute">> {
  edits.require();

  // The window's messages (Allow edits among them) come through this handler: code may not keep it.
  const ui = (figma as { ui?: { onmessage?: unknown } }).ui;
  const handler = ui?.onmessage;

  try {
    return await ran(code, timeoutMs, {
      output: new CapturedConsole(),
      pw: scope.with(codeHelpers()),
    });
  } finally {
    if (ui !== undefined && ui.onmessage !== handler) {
      ui.onmessage = handler;
    }

    figma.commitUndo();
  }
}

/** The code's answer: its value, what it threw, or that it ran past its time; with what it printed. */
async function ran(
  code: string,
  timeoutMs: number,
  { output, pw }: { readonly output: CapturedConsole; readonly pw: Record<string, unknown> },
): Promise<OperationOutput<"execute">> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const run = new AsyncFunction("figma", "console", "pw", code);
    const value = await Promise.race([
      run(figma, output.console(), pw),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
      }),
    ]);

    if (value === TIMED_OUT) {
      return {
        result: null,
        logs: output.kept(),
        error: `The code ran past ${timeoutMs} ms: it may still be running, and what it changed so far stays (read the layers again).`,
      };
    }

    return {
      result: capped(jsonValue(value) ?? null),
      logs: output.kept(),
    };
  } catch (error) {
    return {
      result: null,
      logs: output.kept(),
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** The console code gets: it keeps the first lines printed, each cut to length, and counts the rest. */
class CapturedConsole {
  readonly #logs: string[] = [];
  #dropped = 0;

  console(): Record<"log" | "info" | "debug" | "warn" | "error", (...values: unknown[]) => void> {
    return {
      log: this.#print(""),
      info: this.#print(""),
      debug: this.#print(""),
      warn: this.#print("warn: "),
      error: this.#print("error: "),
    };
  }

  /** The lines kept, and how many more there were. */
  kept(): string[] {
    return this.#dropped === 0 ? this.#logs : [...this.#logs, `…and ${this.#dropped} more lines`];
  }

  #print(prefix: string): (...values: unknown[]) => void {
    return (...values) => {
      if (this.#logs.length >= EXECUTE_MAX_LOGS) {
        this.#dropped += 1;

        return;
      }

      this.#logs.push(`${prefix}${values.map(printed).join(" ")}`.slice(0, EXECUTE_LOG_CHARS));
    };
  }
}

function printed(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(jsonValue(value)) ?? String(value));
}

/** A result too long for one answer comes back as its start. */
function capped(value: unknown): unknown {
  const json = JSON.stringify(value) ?? "null";

  return json.length <= EXECUTE_RESULT_CHARS
    ? value
    : {
        truncated: true,
        preview: json.slice(0, EXECUTE_RESULT_CHARS),
      };
}
