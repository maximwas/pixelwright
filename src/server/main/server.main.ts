import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { Container } from "@needle-di/core";
import { pino } from "pino";
import { CLOCK } from "../../core/ports/clock.port.ts";
import { LOGGER } from "../../core/ports/logger.port.ts";
import { PLUGIN_LINK } from "../../core/ports/plugin-link.port.ts";
import { NoBridge } from "../adapters/bridge/no-bridge.ts";
import { SystemClock } from "../adapters/clock/system-clock.ts";
import { LOG_DESTINATIONS, LOG_SETTINGS } from "../adapters/logging/logging.tokens.ts";
import { PinoLogger } from "../adapters/logging/pino-logger.ts";
import { SharedLogFile } from "../adapters/logging/shared-log-file.ts";
import { StdoutGuard } from "../adapters/mcp/stdout-guard.ts";
import { CallLogStep } from "../app/tool-runner/steps/call-log-step.ts";
import { ErrorTextStep } from "../app/tool-runner/steps/error-text-step.ts";
import { OutputCheckStep } from "../app/tool-runner/steps/output-check-step.ts";
import { TOOL_CALL_STEPS, TOOL_FACTORY, TOOL_RUNNER } from "../app/tool-runner/tool-runner.tokens.ts";
import { ToolRunner } from "../app/tool-runner/tool-runner.ts";
import { TOOL_CATALOG, ToolCatalog } from "../tools/tool.catalog.ts";
import { ConfigReader } from "./config-reader.ts";
import type { ServerConfig } from "./config-reader.types.ts";
import { ContainerToolFactory } from "./container-tool-factory.ts";
import { McpEndpoint } from "./mcp-endpoint.ts";
import { ShutdownHooks } from "./shutdown-hooks.ts";

/**
 * The server's composition root (A§4.1), the one owner of the container. It binds every interface and value once;
 * concrete classes resolve by themselves, and nothing else in src/ sees the container.
 */
export class ServerMain {
  readonly #container = new Container();

  constructor(config: ServerConfig = new ConfigReader().read()) {
    this.#bindLogging(config);
    this.#bindServices();
  }

  /** The MCP endpoint with every tool registered: start() connects it to stdio, the contract tests to memory. */
  endpoint(): McpEndpoint {
    return this.#container.get(McpEndpoint);
  }

  async start(): Promise<void> {
    // First, before anything can print: stdout carries MCP only (S-056).
    new StdoutGuard().install();

    const endpoint = this.endpoint();

    this.#container.get(ShutdownHooks).install(() => endpoint.close());
    await endpoint.connect(new StdioServerTransport());
    this.#container
      .get(LOGGER)
      .child({ component: "server" })
      .info("pixelwright ready on stdio", { role: this.#container.get(PLUGIN_LINK).state().role });
  }

  #bindLogging({ logLevel, home }: ServerConfig): void {
    this.#container
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

  #bindServices(): void {
    this.#container
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
        useValue: new ContainerToolFactory(this.#container),
      })
      .bind({
        provide: TOOL_RUNNER,
        useClass: ToolRunner,
      });
  }
}
