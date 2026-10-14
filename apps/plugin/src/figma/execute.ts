import {
  EXECUTE_LOG_CHARS,
  EXECUTE_MAX_LOGS,
  EXECUTE_RESULT_CHARS,
  type OperationInput,
  type OperationOutput,
} from "@pixelwright/core";
import type { EditsGuard } from "../services/edits-guard.ts";
import { jsonValue } from "../utils/json-value.ts";

type AsyncBody = new (...names: string[]) => (...values: unknown[]) => Promise<unknown>;

/** The constructor of async functions: the code becomes the body of one. */
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as AsyncBody;

/** What the race gives when the timer wins. */
const TIMED_OUT = Symbol("timed out");

/**
 * Code as the body of an async function, given figma and a console that keeps what it prints: its value made JSON-safe,
 * or what it threw, or that it ran past its time (it may still be running: a plugin cannot stop it). Whatever it
 * changed is one undo step. Refused while Allow edits is off.
 */
export async function execute(
  { code, timeoutMs }: OperationInput<"execute">,
  edits: EditsGuard,
): Promise<OperationOutput<"execute">> {
  edits.require();

  const logs: string[] = [];
  let dropped = 0;
  const print =
    (prefix: string) =>
    (...values: unknown[]) => {
      if (logs.length >= EXECUTE_MAX_LOGS) {
        dropped += 1;

        return;
      }

      logs.push(`${prefix}${values.map(printed).join(" ")}`.slice(0, EXECUTE_LOG_CHARS));
    };
  const capture = {
    log: print(""),
    info: print(""),
    debug: print(""),
    warn: print("warn: "),
    error: print("error: "),
  };
  const kept = () => (dropped === 0 ? logs : [...logs, `…and ${dropped} more lines`]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The window's messages (Allow edits among them) come through this handler: code may not keep it.
  const ui = (figma as { ui?: { onmessage?: unknown } }).ui;
  const handler = ui?.onmessage;

  try {
    const run = new AsyncFunction("figma", "console", code);
    const value = await Promise.race([
      run(figma, capture),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
      }),
    ]);

    if (value === TIMED_OUT) {
      return {
        result: null,
        logs: kept(),
        error: `The code ran past ${timeoutMs} ms: it may still be running, and what it changed so far stays (read the layers again).`,
      };
    }

    return {
      result: capped(jsonValue(value) ?? null),
      logs: kept(),
    };
  } catch (error) {
    return {
      result: null,
      logs: kept(),
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timer);

    if (ui !== undefined && ui.onmessage !== handler) {
      ui.onmessage = handler;
    }

    figma.commitUndo();
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
