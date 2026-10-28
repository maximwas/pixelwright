import { inspect } from "node:util";
import { STDOUT_GUARD } from "@/server/adapters/mcp/stdout-guard/stdout-guard.constants.ts";

/**
 * stdout carries MCP JSON-RPC only (S-056), so console output goes to stderr. Libraries log through the global console
 * and modules keep references to that object, so it is patched in place; table, group, count and time* print through
 * console.log, so they are covered too.
 */
export class StdoutGuard {
  readonly #console: Console;
  readonly #stderr: NodeJS.WritableStream;

  constructor(
    target: Console = console,
    stderr: NodeJS.WritableStream = process.stderr,
  ) {
    this.#console = target;
    this.#stderr = stderr;
  }

  install(): void {
    const target = this.#console;

    target.log = target.error;
    target.info = target.error;
    target.debug = target.error;
    target.dir = (
      item,
      options,
    ) => {
      this.#stderr.write(STDOUT_GUARD.line(inspect(item, options)));
    };
  }
}
