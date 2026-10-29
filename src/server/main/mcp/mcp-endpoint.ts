import { McpServer, type Transport } from "@modelcontextprotocol/server";
import { inject, injectable } from "@needle-di/core";
import { MCP_ROOTS } from "@/server/adapters/mcp/mcp-roots.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOOL_RUNNER } from "@/server/app/tool-runner/tool-runner.ts";
import { MCP_ENDPOINT_ERROR, SERVER_INSTRUCTIONS } from "@/server/main/mcp/mcp.constants.ts";
import { McpToolSchema } from "@/server/main/mcp/mcp-tool-schema.ts";
import { TOOL_CATALOG } from "@/server/tools/tool.catalog.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/**
 * Adapter over the SDK's McpServer: the channel's name and version, the server instructions (T-007), every catalog
 * tool registered in catalog order with its call handed to the tool runner, and the client's roots for the project
 * folder (T-008). The SDK server is built when it connects.
 */
@injectable()
export class McpEndpoint {
  readonly #catalog;
  readonly #runner;
  readonly #roots;
  #server: McpServer | undefined;

  constructor(
    catalog = inject(TOOL_CATALOG),
    runner = inject(TOOL_RUNNER),
    roots = inject(MCP_ROOTS),
  ) {
    this.#catalog = catalog;
    this.#runner = runner;
    this.#roots = roots;
  }

  /** Builds the MCP server with every tool, once, and connects it to the transport. */
  async connect(transport: Transport): Promise<void> {
    if (this.#server !== undefined) {
      throw new Error(MCP_ENDPOINT_ERROR.connected);
    }

    const server = new McpServer({ name: CHANNEL.name, version: VERSION }, { instructions: SERVER_INSTRUCTIONS });

    for (const manifest of this.#catalog.manifests()) {
      this.#register(server, manifest);
    }

    this.#roots.attach(server.server);
    this.#server = server;
    await server.connect(transport);
  }

  async close(): Promise<void> {
    await this.#server?.close();
  }

  #register(server: McpServer, manifest: ToolManifest): void {
    const { name, title, description, input, output, annotations } = manifest;
    const config = {
      title,
      description,
      inputSchema: new McpToolSchema(input),
      outputSchema: new McpToolSchema(output),
      annotations,
    };

    server.registerTool(name, config, async (args, context) => {
      const answer = await this.#runner.run({ manifest, args, signal: context.mcpReq.signal });

      return { ...answer, content: [...answer.content] };
    });
  }
}
