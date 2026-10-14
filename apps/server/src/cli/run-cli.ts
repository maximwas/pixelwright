import { homedir } from "node:os";
import { join } from "node:path";
import { cancel } from "@clack/prompts";
import serverPackage from "../../package.json" with { type: "json" };
import { homeDir } from "../bridge/bridge-config.ts";
import { readConfig } from "../config/config.ts";
import { HELP_TEXT, STARTED_IN_TERMINAL } from "../constants/cli.ts";
import { startMcp } from "../main.ts";
import { parseCommand } from "../utils/cli-command.ts";
import { errorMessage } from "../utils/error-message.ts";
import { SetupCancelled } from "./cancel.ts";
import { packagedPlugin } from "./plugin-files.ts";
import { printSetup } from "./setup-text.ts";
import { runWizard } from "./wizard.ts";

/** The command line: the MCP server for MCP clients, the setup for a person at a terminal. */
export async function runCli(args: readonly string[]): Promise<void> {
  const interactive = (process.stdin.isTTY ?? false) && (process.stdout.isTTY ?? false);
  const command = parseCommand(args, interactive);
  const pluginHome = join(homeDir(), "plugin");

  switch (command.kind) {
    case "mcp":
      if (process.stdin.isTTY ?? false) {
        process.stderr.write(STARTED_IN_TERMINAL);
      }

      await startMcp();

      return;
    case "setup":
      if (command.print) {
        try {
          process.stdout.write(
            await printSetup({
              from: packagedPlugin(),
              pluginHome,
              platform: process.platform,
            }),
          );
        } catch (error) {
          process.stderr.write(`${errorMessage(error)}\n`);
          process.exitCode = 1;
        }

        return;
      }

      try {
        await runWizard({
          home: homedir(),
          pluginHome,
        });
      } catch (error) {
        if (!(error instanceof SetupCancelled)) {
          throw error;
        }

        cancel(error.message);
        process.exitCode = 1;
      }

      return;
    case "logs": {
      const { followLog } = await import("../logging/follow-log.ts");

      await followLog(readConfig(process.env).logFile, (line) => process.stdout.write(`${line}\n`));

      return;
    }
    case "version":
      process.stdout.write(`${serverPackage.version}\n`);

      return;
    case "help":
      process.stdout.write(HELP_TEXT);

      return;
    case "unknown":
      process.stderr.write(`Unknown command: ${command.argument}\n\n${HELP_TEXT}`);
      process.exitCode = 2;
  }
}
