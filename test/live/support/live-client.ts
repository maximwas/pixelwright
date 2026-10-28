import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { TEST_MCP } from "./test-mcp.ids.ts";

/** A tool's answer: its structuredContent. */
export type ToolResult = Record<string, unknown>;

/** A file as status lists it, the fields the harness reads. */
export interface StatusFile {
  readonly session: string;
  readonly name: string;
  readonly page: string;
  readonly visible: boolean;
  readonly allowEdits: boolean;
}

/** How long a test waits for Test MCP's plugin to reach its server: the plugin's backoff tops out near 10 s. */
const CONNECT_WAIT_MS = 120_000;
const POLL_MS = 1_000;
/** A tool call's own wait: above the longest op timeout (310 s). */
const CALL_TIMEOUT_MS = 320_000;

/**
 * One server from dist/bin.mjs as an MCP client over stdio (A§10.5). Every tool that takes `file` must name Test MCP,
 * so nothing a test does lands in another open file (R-001).
 */
export class LiveClient {
  readonly #client = new Client({
    name: "pixelwright-live",
    version: "1.0.0",
  });
  #takesFile: ReadonlySet<string> = new Set();

  async connect(): Promise<this> {
    await this.#client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(process.cwd(), "dist", "bin.mjs")],
        env: Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
        stderr: "ignore",
      }),
    );

    const { tools } = await this.#client.listTools();

    this.#takesFile = new Set(
      tools.filter((tool) => tool.inputSchema.properties?.file !== undefined).map((tool) => tool.name),
    );

    return this;
  }

  /** The tool's structuredContent; an error answer throws with its text. */
  async call(
    tool: string,
    args: ToolResult = {},
  ): Promise<ToolResult> {
    if (this.#takesFile.has(tool) && args.file !== TEST_MCP.file) {
      throw new Error(`live tests call ${tool} with file: "${TEST_MCP.file}" only, not ${JSON.stringify(args.file)}.`);
    }

    const answer = await this.#client.callTool(
      {
        name: tool,
        arguments: args,
      },
      { timeout: CALL_TIMEOUT_MS },
    );

    if (answer.isError === true || typeof answer.structuredContent !== "object" || answer.structuredContent === null) {
      throw new Error(`${tool}: ${JSON.stringify(answer.content)}`);
    }

    return answer.structuredContent as ToolResult;
  }

  /** status, once Test MCP's plugin is connected to this server or its owner; throws after two minutes. */
  async waitForTestMcp(): Promise<{ status: ToolResult; file: StatusFile }> {
    const deadline = Date.now() + CONNECT_WAIT_MS;

    while (Date.now() < deadline) {
      const status = await this.call("status");
      const file = (status.files as StatusFile[]).find((connected) => connected.name === TEST_MCP.file);

      if (file !== undefined) {
        return {
          status,
          file,
        };
      }

      await sleep(POLL_MS);
    }

    throw new Error(
      `Test MCP did not connect in ${CONNECT_WAIT_MS / 1000} s: open it in Figma Desktop and run the ${CHANNEL.pluginName} plugin there.`,
    );
  }

  async close(): Promise<void> {
    await this.#client.close();
  }
}
