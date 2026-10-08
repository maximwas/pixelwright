import { inspect } from "node:util";

/**
 * stdout carries MCP JSON-RPC only, so console output goes to stderr. Libraries may log through the global console,
 * and modules keep references to that object, so it is patched in place. table, group, count and time* print through
 * console.log, so they are covered too.
 */
export function guardStdout(): void {
  console.log = console.error;
  console.info = console.error;
  console.debug = console.error;
  console.dir = (item, options) => {
    process.stderr.write(`${inspect(item, options)}\n`);
  };
}
