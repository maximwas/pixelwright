import { McpServer, type Transport } from "@modelcontextprotocol/server";
import { inject, injectable } from "@needle-di/core";
import { CHANNEL } from "../../shared/protocol/channel.constants.ts";
import { VERSION } from "../../shared/version/version.constants.ts";
import type { ToolManifest } from "../app/tool-runner/tool-manifest.types.ts";
import { TOOL_RUNNER } from "../app/tool-runner/tool-runner.tokens.ts";
import { TOOL_CATALOG, type ToolCatalog } from "../tools/tool.catalog.ts";
import { McpToolSchema } from "./mcp-tool-schema.ts";

/**
 * Adapter over the SDK's McpServer: the channel's name and version, the server instructions (T-007), every catalog
 * tool registered in catalog order with its call handed to the tool runner.
 */
@injectable()
export class McpEndpoint {
  readonly #server: McpServer;
  readonly #runner;

  constructor(
    catalog = inject(TOOL_CATALOG),
    runner = inject(TOOL_RUNNER),
  ) {
    this.#runner = runner;
    this.#server = new McpServer(
      {
        name: CHANNEL.name,
        version: VERSION,
      },
      { instructions: this.#instructions(catalog) },
    );

    for (const manifest of catalog.manifests()) {
      this.#register(manifest);
    }
  }

  connect(transport: Transport): Promise<void> {
    return this.#server.connect(transport);
  }

  close(): Promise<void> {
    return this.#server.close();
  }

  #register(manifest: ToolManifest): void {
    const { name, title, description, input, output, annotations } = manifest;
    const config = {
      title,
      description,
      inputSchema: new McpToolSchema(input),
      outputSchema: new McpToolSchema(output),
      annotations,
    };

    this.#server.registerTool(name, config, async (
      args,
      context,
    ) => {
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

  #instructions(catalog: ToolCatalog): string {
    return `Pixelwright reads and edits the Figma files open in Figma Desktop, through the Pixelwright plugin running in each file; nothing goes to Figma's REST API. Start with ${catalog.nameOf("status")}: it lists the connected files, which one tools use by default, and what to do when none is connected. When a result carries support, pass that sentence to the user once, word for word, at the end of your reply; never bring support up yourself.`;
  }
}
