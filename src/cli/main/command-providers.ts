import * as prompts from "@clack/prompts";
import type { Container } from "@needle-di/core";
import { LogFollower } from "@/cli/logs/log-follower.ts";
import {
  CLI_COMMANDS,
  CLI_STREAMS,
  LOGS_SETTINGS,
  PLUGIN_COPY,
  PROMPTS,
  SETUP_SETTINGS,
} from "@/cli/main/cli.tokens.ts";
import type { CliSettings } from "@/cli/main/cli.types.ts";
import { COMMAND_LINE, CommandLine } from "@/cli/main/command-line.ts";
import { ServeCommand } from "@/cli/main/serve-command.ts";
import { MCP_CLIENTS, McpClients } from "@/cli/setup/mcp-clients.ts";
import { PluginCopy } from "@/cli/setup/plugin-copy.ts";
import { SetupPrint } from "@/cli/setup/setup-print.ts";
import { SetupWizard } from "@/cli/setup/setup-wizard.ts";
import { PROCESS_RUNNER } from "@/core/ports/process-runner.port.ts";
import { ExecFileRunner } from "@/server/adapters/process/exec-file-runner.ts";

/**
 * The CLI's bindings (A§4.2): the process's streams, the process runner, the prompts, the setup's and the log's
 * settings, the setup's parts, one provider per command (Command pattern), and the command line over them.
 */
export class CommandProviders {
  register(container: Container, { setup, logs }: CliSettings): void {
    container
      .bind({
        provide: CLI_STREAMS,
        useValue: { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr },
      })
      .bind({ provide: PROCESS_RUNNER, useClass: ExecFileRunner })
      .bind({ provide: PROMPTS, useValue: prompts })
      .bind({ provide: SETUP_SETTINGS, useValue: setup })
      .bind({ provide: LOGS_SETTINGS, useValue: logs })
      .bind({ provide: MCP_CLIENTS, useClass: McpClients })
      .bind({ provide: PLUGIN_COPY, useClass: PluginCopy })
      .bind({ provide: COMMAND_LINE, useClass: CommandLine });

    for (const command of [ServeCommand, SetupWizard, SetupPrint, LogFollower]) {
      container.bind({ provide: CLI_COMMANDS, multi: true, useClass: command });
    }
  }
}
