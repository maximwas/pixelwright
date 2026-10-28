import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { Container } from "@needle-di/core";
import { pino } from "pino";
import { CLOCK } from "../../core/ports/clock/clock.port.ts";
import { LOGGER } from "../../core/ports/logger/logger.port.ts";
import { PLUGIN_LINK } from "../../core/ports/plugin-link/plugin-link.port.ts";
import { NoBridge } from "../adapters/bridge/no-bridge/no-bridge.ts";
import { SystemClock } from "../adapters/clock/system-clock/system-clock.ts";
import { LOG_DESTINATIONS, LOG_SETTINGS } from "../adapters/logging/logging.tokens.ts";
import { PinoLogger } from "../adapters/logging/pino-logger/pino-logger.ts";
import { SharedLogFile } from "../adapters/logging/shared-log-file/shared-log-file.ts";
import { StdoutGuard } from "../adapters/mcp/stdout-guard/stdout-guard.ts";
import { CallLogStep } from "../app/tool-runner/steps/call-log-step/call-log-step.ts";
import { ErrorTextStep } from "../app/tool-runner/steps/error-text-step/error-text-step.ts";
import { OutputCheckStep } from "../app/tool-runner/steps/output-check-step/output-check-step.ts";
import { TOOL_CALL_STEPS, TOOL_FACTORY, TOOL_RUNNER } from "../app/tool-runner/tool-runner/tool-runner.tokens.ts";
import { ToolRunner } from "../app/tool-runner/tool-runner/tool-runner.ts";
import { TOOL_CATALOG, ToolCatalog } from "../tools/tool.catalog.ts";
import { ConfigReader } from "./config-reader/config-reader.ts";
import type { ServerConfig } from "./config-reader/config-reader.types.ts";
import { ContainerToolFactory } from "./container-tool-factory/container-tool-factory.ts";
import { McpEndpoint } from "./mcp-endpoint/mcp-endpoint.ts";
import { ShutdownHooks } from "./shutdown-hooks/shutdown-hooks.ts";

/**
 * The server's composition root (A§4.1), the one owner of the container. It binds every interface and value once;
 * concrete classes resolve by themselves, and nothing else in src/ sees the container.
 */
export class ServerMain {
  /** Given by the contract tests; read from the environment otherwise. */
  readonly #config: ServerConfig | undefined;
  #container: Container | undefined;

  constructor(config?: ServerConfig) {
    this.#config = config;
  }

  /** The MCP endpoint: start() connects it to stdio, the contract tests to memory. */
  endpoint(): McpEndpoint {
    return this.#composed().get(McpEndpoint);
  }

  async start(): Promise<void> {
    // First, before anything can print: stdout carries MCP only (S-056).
    new StdoutGuard().install();

    const container = this.#composed();
    const endpoint = container.get(McpEndpoint);

    container.get(ShutdownHooks).install(() => endpoint.close());
    await endpoint.connect(new StdioServerTransport());
    container
      .get(LOGGER)
      .child({ component: "server" })
      .info("pixelwright ready on stdio", { role: container.get(PLUGIN_LINK).state().role });
  }

  /** The container with every binding, built once at first use: reading the environment is no constructor's work. */
  #composed(): Container {
    this.#container ??= this.#compose(this.#config ?? new ConfigReader().read());

    return this.#container;
  }

  #compose(config: ServerConfig): Container {
    const container = new Container();

    this.#bindLogging(container, config);
    this.#bindServices(container);

    return container;
  }

  #bindLogging(
    container: Container,
    { logLevel, home }: ServerConfig,
  ): void {
    container
      .bind({
        provide: LOG_SETTINGS,
        useValue: {
          level: logLevel,
          file: join(home, "logs", "pixelwright.log"),
        },
      })
      .bind({
        provide: LOG_DESTINATIONS,
        multi: true,
        useValue: pino.destination({
          dest: 2,
          sync: true,
        }),
      })
      .bind({
        provide: LOG_DESTINATIONS,
        multi: true,
        useClass: SharedLogFile,
      })
      .bind({
        provide: LOGGER,
        useClass: PinoLogger,
      })
      .bind({
        provide: CLOCK,
        useClass: SystemClock,
      });
  }

  #bindServices(container: Container): void {
    container
      // shortcut: every run is bridge-off until item 02 binds OwnerBridge when config.pluginBridge is true.
      .bind({
        provide: PLUGIN_LINK,
        useClass: NoBridge,
      })
      .bind({
        provide: TOOL_CATALOG,
        useClass: ToolCatalog,
      })
      // The runner's chain, outermost first: error text, call log, output check.
      .bind({
        provide: TOOL_CALL_STEPS,
        multi: true,
        useClass: ErrorTextStep,
      })
      .bind({
        provide: TOOL_CALL_STEPS,
        multi: true,
        useClass: CallLogStep,
      })
      .bind({
        provide: TOOL_CALL_STEPS,
        multi: true,
        useClass: OutputCheckStep,
      })
      .bind({
        provide: TOOL_FACTORY,
        useValue: new ContainerToolFactory(container),
      })
      .bind({
        provide: TOOL_RUNNER,
        useClass: ToolRunner,
      });
  }
}
