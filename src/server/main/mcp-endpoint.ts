import { McpServer, type Transport } from "@modelcontextprotocol/server";
import { inject, injectable } from "@needle-di/core";
import { CHANNEL } from "../../shared/protocol/channel.constants.ts";
import { VERSION } from "../../shared/version/version.constants.ts";
import type { ToolManifest } from "../app/tool-runner/tool-manifest.types.ts";
import { TOOL_RUNNER } from "../app/tool-runner/tool-runner.tokens.ts";
import { TOOL_CATALOG } from "../tools/tool.catalog.ts";
import { McpToolSchema } from "./mcp-tool-schema.ts";
import { SERVER_INSTRUCTIONS } from "./server-instructions.constants.ts";

/**
 * Adapter over the SDK's McpServer: the channel's name and version, the server instructions (T-007), every catalog
 * tool registered in catalog order with its call handed to the tool runner. The SDK server is built when it connects.
 */
@injectable()
export class McpEndpoint {
  readonly #catalog;
  readonly #runner;
  #server: McpServer | undefined;

  constructor(
    catalog = inject(TOOL_CATALOG),
    runner = inject(TOOL_RUNNER),
  ) {
    this.#catalog = catalog;
    this.#runner = runner;
  }

  /** Builds the MCP server with every tool, once, and connects it to the transport. */
  async connect(transport: Transport): Promise<void> {
    if (this.#server !== undefined) {
      throw new Error("The MCP endpoint is connected already.");
    }

    const server = new McpServer(
      {
        name: CHANNEL.name,
        version: VERSION,
      },
      { instructions: SERVER_INSTRUCTIONS },
    );

    for (const manifest of this.#catalog.manifests()) {
      this.#register(server, manifest);
    }

    this.#server = server;
    await server.connect(transport);
  }

  async close(): Promise<void> {
    await this.#server?.close();
  }

  #register(
    server: McpServer,
    manifest: ToolManifest,
  ): void {
    const { name, title, description, input, output, annotations } = manifest;
    const config = {
      title,
      description,
      inputSchema: new McpToolSchema(input),
      outputSchema: new McpToolSchema(output),
      annotations,
    };

    server.registerTool(name, config, async (args, context) => {
      const answer = await this.#runner.run({
        manifest,
        args,
        signal: context.mcpReq.signal,
      });

      return {
        ...answer,
        content: [...answer.content],
      };
    });
  }
}
