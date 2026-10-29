import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { Container } from "@needle-di/core";
import { pino } from "pino";
import { NUMBER_FORMAT, NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { CLIENT_ROOTS } from "@/core/ports/client-roots.port.ts";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { JSON_FILE } from "@/core/ports/json-file.port.ts";
import { LOG_COMPONENT } from "@/core/ports/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger.port.ts";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { OUTLINE_XML, OutlineXml } from "@/core/xml/outline/outline-xml.ts";
import { XML_ESCAPE, XmlEscape } from "@/core/xml/xml-escape.ts";
import { SystemClock } from "@/server/adapters/clock/system-clock.ts";
import { AtomicJsonFile } from "@/server/adapters/files/atomic-json-file.ts";
import { LOG_DESTINATIONS, LOG_SETTINGS } from "@/server/adapters/logging/logging.tokens.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger.ts";
import { SharedLogFile } from "@/server/adapters/logging/shared-log-file.ts";
import { MCP_ROOTS, McpRoots } from "@/server/adapters/mcp/mcp-roots.ts";
import { StdoutGuard } from "@/server/adapters/mcp/stdout-guard.ts";
import { PROJECT_FALLBACK, PROJECT_FOLDER, ProjectFolder } from "@/server/app/project/project-folder.ts";
import { WITHIN_SCOPE, WithinScope } from "@/server/app/scope/within-scope.ts";
import { OP_CALL_STEPS } from "@/server/app/sessions/plugin-session.ts";
import { PLUGIN_SESSIONS, PluginSessions } from "@/server/app/sessions/plugin-sessions.ts";
import { OpLogStep } from "@/server/app/sessions/steps/op-log-step.ts";
import { OpResultStep } from "@/server/app/sessions/steps/op-result-step.ts";
import { OpTimerStep } from "@/server/app/sessions/steps/op-timer-step.ts";
import { TARGET_RESOLVER, TargetResolver } from "@/server/app/sessions/target-resolver.ts";
import { CallLogStep } from "@/server/app/tool-runner/steps/call-log-step.ts";
import { ErrorTextStep } from "@/server/app/tool-runner/steps/error-text-step.ts";
import { OutputCheckStep } from "@/server/app/tool-runner/steps/output-check-step.ts";
import { TargetStep } from "@/server/app/tool-runner/steps/target-step.ts";
import { TOOL_CALL_STEPS, TOOL_FACTORY, TOOL_RUNNER, ToolRunner } from "@/server/app/tool-runner/tool-runner.ts";
import { BridgeProviders } from "@/server/main/bridge-providers.ts";
import { ConfigReader, type ServerConfig } from "@/server/main/config/config-reader.ts";
import { ContainerToolFactory } from "@/server/main/container-tool-factory.ts";
import { McpEndpoint } from "@/server/main/mcp/mcp-endpoint.ts";
import { LOG_FILE, SERVER_LOG } from "@/server/main/server.constants.ts";
import { ShutdownHooks } from "@/server/main/shutdown-hooks.ts";
import { TOOL_CATALOG, ToolCatalog } from "@/server/tools/tool.catalog.ts";

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

  /** The composed container, for the composition test alone (A§10.2): nothing else outside main/ sees it. */
  container(): Container {
    return this.#composed();
  }

  async start(): Promise<void> {
    // First, before anything can print: stdout carries MCP only (S-056).
    new StdoutGuard().install();

    const container = this.#composed();

    // The bridge before MCP (A§4.1): the first status call already sees the owner.
    await this.listen();
    container.get(ShutdownHooks).install(() => this.close());
    await container.get(McpEndpoint).connect(new StdioServerTransport());
    container
      .get(LOGGER)
      .child({ component: LOG_COMPONENT.server })
      .info(SERVER_LOG.ready, { role: container.get(PLUGIN_LINK).role() });
  }

  /** Takes the plugin bridge up: the owner listens on the channel's port. The contract tests start it without stdio. */
  async listen(): Promise<void> {
    await this.#composed().get(PLUGIN_LINK).start();
  }

  /** The bridge frees its port first, so a sibling server can take it at once, then MCP closes (S-013). */
  async close(): Promise<void> {
    const container = this.#composed();

    await container.get(PLUGIN_LINK).close();
    await container.get(McpEndpoint).close();
  }

  /** The container with every binding, built once at first use: reading the environment is no constructor's work. */
  #composed(): Container {
    this.#container ??= this.#compose(this.#config ?? new ConfigReader().read());

    return this.#container;
  }

  #compose(config: ServerConfig): Container {
    const container = new Container();

    this.#bindInfra(container, config);
    this.#bindDomain(container);
    new BridgeProviders().register(container, config);
    this.#bindServices(container);

    return container;
  }

  /** The log, the clock, the home's JSON files and the project folder: what every other service may need. */
  #bindInfra(container: Container, { logLevel, home, projectDir }: ServerConfig): void {
    container
      .bind({ provide: LOG_SETTINGS, useValue: { level: logLevel, file: join(home, LOG_FILE.folder, LOG_FILE.name) } })
      .bind({ provide: LOG_DESTINATIONS, multi: true, useValue: pino.destination({ dest: 2, sync: true }) })
      .bind({ provide: LOG_DESTINATIONS, multi: true, useClass: SharedLogFile })
      .bind({ provide: LOGGER, useClass: PinoLogger })
      .bind({ provide: CLOCK, useClass: SystemClock })
      .bind({ provide: JSON_FILE, useClass: AtomicJsonFile })
      .bind({ provide: MCP_ROOTS, useClass: McpRoots })
      .bind({ provide: CLIENT_ROOTS, useExisting: MCP_ROOTS })
      .bind({ provide: PROJECT_FALLBACK, useValue: projectDir })
      .bind({ provide: PROJECT_FOLDER, useClass: ProjectFolder });
  }

  /** The core domain's classes the tools read and write with: the D-15 numbers and the XML writers. */
  #bindDomain(container: Container): void {
    container
      .bind({ provide: NUMBER_FORMAT, useClass: NumberFormat })
      .bind({ provide: XML_ESCAPE, useClass: XmlEscape })
      .bind({ provide: OUTLINE_XML, useClass: OutlineXml });
  }

  /**
   * The plugin sessions (A§6.1): target resolution, each op's chain, outermost first: log, timeout text, result; and
   * the `within` scope a tool's ops go through (S-043).
   */
  #bindSessions(container: Container): void {
    for (const step of [OpLogStep, OpTimerStep, OpResultStep]) {
      container.bind({ provide: OP_CALL_STEPS, multi: true, useClass: step });
    }

    container
      .bind({ provide: TARGET_RESOLVER, useClass: TargetResolver })
      .bind({ provide: PLUGIN_SESSIONS, useClass: PluginSessions })
      .bind({ provide: WITHIN_SCOPE, useClass: WithinScope });
  }

  #bindServices(container: Container): void {
    this.#bindSessions(container);

    // The runner's chain, outermost first: error text, call log, target, output check.
    for (const step of [ErrorTextStep, CallLogStep, TargetStep, OutputCheckStep]) {
      container.bind({ provide: TOOL_CALL_STEPS, multi: true, useClass: step });
    }

    container
      .bind({ provide: TOOL_CATALOG, useClass: ToolCatalog })
      .bind({ provide: TOOL_FACTORY, useValue: new ContainerToolFactory(container) })
      .bind({ provide: TOOL_RUNNER, useClass: ToolRunner });
  }
}
