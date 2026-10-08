import serverPackage from "../../package.json" with { type: "json" };
import { HELP_FLAGS, HELP_TEXT, STARTED_IN_TERMINAL, VERSION_FLAGS } from "../constants/cli.ts";
import { startMcp } from "../main.ts";

/** The command line: no arguments is the MCP server (the setup wizard joins in stage 6). */
export async function runCli(args: readonly string[]): Promise<void> {
  const [command, ...rest] = args;

  if (command === undefined) {
    if (process.stdin.isTTY) {
      process.stderr.write(STARTED_IN_TERMINAL);
    }

    await startMcp();

    return;
  }

  if (rest.length === 0 && VERSION_FLAGS.has(command)) {
    process.stdout.write(`${serverPackage.version}\n`);

    return;
  }

  if (rest.length === 0 && HELP_FLAGS.has(command)) {
    process.stdout.write(HELP_TEXT);

    return;
  }

  process.stderr.write(`Unknown command: ${args.join(" ")}\n\n${HELP_TEXT}`);
  process.exitCode = 2;
}
