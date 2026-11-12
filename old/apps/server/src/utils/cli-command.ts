import { parseArgs } from "node:util";
import type { CliCommand } from "../types/cli.ts";

/**
 * The command a command line asks for. With no arguments it is the MCP server, which is how MCP clients start it, unless
 * a person runs it at a terminal: then it is the setup. `serve` is the server whatever stdin is. `setup` away from a
 * terminal prints, as `setup --print` does: its questions need a person.
 */
export function parseCommand(args: readonly string[], interactive: boolean): CliCommand {
  const [first, ...rest] = args;

  if (first === undefined) {
    return interactive
      ? {
          kind: "setup",
          print: false,
        }
      : { kind: "mcp" };
  }

  const unknown: CliCommand = {
    kind: "unknown",
    argument: args.join(" "),
  };

  if (rest.length === 0 && ["--version", "-v", "version"].includes(first)) {
    return { kind: "version" };
  }

  if (rest.length === 0 && ["--help", "-h", "help"].includes(first)) {
    return { kind: "help" };
  }

  if (rest.length === 0 && first === "serve") {
    return { kind: "mcp" };
  }

  if (rest.length === 0 && first === "logs") {
    return { kind: "logs" };
  }

  if (first !== "setup") {
    return unknown;
  }

  try {
    const { values } = parseArgs({
      args: rest,
      options: { print: { type: "boolean" } },
      strict: true,
      allowPositionals: false,
    });

    return {
      kind: "setup",
      print: (values.print ?? false) || !interactive,
    };
  } catch {
    return unknown;
  }
}
