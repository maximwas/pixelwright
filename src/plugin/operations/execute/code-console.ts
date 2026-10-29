import type { CodeValue } from "@/plugin/operations/execute/code-value.ts";
import { CODE_OUTPUT, CODE_PRINT } from "@/plugin/operations/execute/execute.constants.ts";

type ConsoleMethod = keyof typeof CODE_PRINT.prefix;

/** The console one call's code gets (P-162): it keeps the first lines printed, each cut to length, and counts the rest. */
export class CodeConsole {
  readonly #values: CodeValue;
  readonly #logs: string[] = [];
  #dropped = 0;

  constructor(values: CodeValue) {
    this.#values = values;
  }

  console(): Record<ConsoleMethod, (...values: unknown[]) => void> {
    return {
      log: this.#print(CODE_PRINT.prefix.log),
      info: this.#print(CODE_PRINT.prefix.info),
      debug: this.#print(CODE_PRINT.prefix.debug),
      warn: this.#print(CODE_PRINT.prefix.warn),
      error: this.#print(CODE_PRINT.prefix.error),
    };
  }

  /** The lines kept, and how many more there were. */
  kept(): string[] {
    return this.#dropped === 0 ? [...this.#logs] : [...this.#logs, CODE_PRINT.dropped(this.#dropped)];
  }

  #print(prefix: string): (...values: unknown[]) => void {
    return (...values) => {
      if (this.#logs.length >= CODE_OUTPUT.maxLogs) {
        this.#dropped += 1;

        return;
      }

      const text = values.map((value) => this.#values.printed(value)).join(CODE_PRINT.separator);

      this.#logs.push(CODE_PRINT.line(prefix, text).slice(0, CODE_OUTPUT.logChars));
    };
  }
}
