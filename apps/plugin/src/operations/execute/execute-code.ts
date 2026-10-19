import {
  EXECUTE_LOG_CHARS,
  EXECUTE_MAX_LOGS,
  EXECUTE_RESULT_CHARS,
  type OperationInput,
  type OperationOutput,
} from "@pixelwright/core";
import pTimeout from "p-timeout";
import type { CodeScope } from "../../services/code-scope.ts";
import type { EditsGuard } from "../../services/edits-guard.ts";
import { codeError, codeFunction } from "./code-error.ts";
import { codeHelpers } from "./code-helpers.ts";
import { jsonValue } from "./json-value.ts";

/** What the run gives when its time is up first. */
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
  // Every operation walks layers as the plugin set this up; code may turn it off to reach hidden instance children.
  const skipInvisible = figma.skipInvisibleInstanceChildren;

  try {
    return await ran(code, timeoutMs, {
      output: new CapturedConsole(),
      pw: scope.with(codeHelpers()),
    });
  } finally {
    if (ui !== undefined && ui.onmessage !== handler) {
      ui.onmessage = handler;
    }

    figma.skipInvisibleInstanceChildren = skipInvisible;
    figma.commitUndo();
  }
}

/** The code's answer: its value, what it threw, or that it ran past its time; with what it printed. */
async function ran(
  code: string,
  timeoutMs: number,
  { output, pw }: { readonly output: CapturedConsole; readonly pw: Record<string, unknown> },
): Promise<OperationOutput<"execute">> {
  try {
    const run = codeFunction(code);
    const value = await pTimeout(run(figma, output.console(), pw), {
      milliseconds: timeoutMs,
      fallback: () => TIMED_OUT,
    });

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
      error: await codeError(error, code),
    };
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
