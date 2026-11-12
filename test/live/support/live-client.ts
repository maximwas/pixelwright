import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { TEST_MCP } from "./test-mcp.ids.ts";

/** A tool's answer: its structuredContent. */
export type ToolResult = Record<string, unknown>;

/** One content block of an answer: a text, or an image as base64 with its type. */
export interface LiveBlock {
  readonly type: string;
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
}

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
  readonly #client = new Client({ name: "pixelwright-live", version: "1.0.0" });
  #takesFile: ReadonlySet<string> = new Set();

  /** The server with the test's environment, and these variables over it (a temp PIXELWRIGHT_HOME, say). */
  async connect(env: Readonly<Record<string, string>> = {}): Promise<this> {
    await this.#client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(process.cwd(), "dist", "bin.mjs")],
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
          ),
          ...env,
        },
        stderr: "ignore",
      }),
    );

    const { tools } = await this.#client.listTools();

    this.#takesFile = new Set(
      tools.filter((tool) => tool.inputSchema.properties?.file !== undefined).map((tool) => tool.name),
    );

    return this;
  }

  /** The tool's structuredContent; an error answer throws with its text, an aborted call with the abort. */
  async call(
    tool: string,
    args: ToolResult = {},
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const answer = await this.#answer(tool, args, signal);

    if (answer.isError === true || typeof answer.structuredContent !== "object" || answer.structuredContent === null) {
      throw new Error(`${tool}: ${JSON.stringify(answer.content)}`);
    }

    return answer.structuredContent as ToolResult;
  }

  /** The text blocks of a tool that answers without structuredContent (design_read); an error answer throws its text. */
  async texts(tool: string, args: ToolResult = {}): Promise<string[]> {
    const answer = await this.#answer(tool, args);

    if (answer.isError === true) {
      throw new Error(`${tool}: ${JSON.stringify(answer.content)}`);
    }

    return (answer.content as { readonly text?: string }[]).map(({ text }) => text ?? "");
  }

  /** A tool's raw answer: its content blocks, images too, and whether it is an error; it never throws on one. */
  async blocks(tool: string, args: ToolResult = {}): Promise<{ isError: boolean; content: LiveBlock[] }> {
    const answer = await this.#answer(tool, args);

    return { isError: answer.isError === true, content: answer.content as LiveBlock[] };
  }

  /** status, once Test MCP's plugin is connected to this server or its owner; throws after two minutes. */
  async waitForTestMcp(): Promise<{ status: ToolResult; file: StatusFile }> {
    const deadline = Date.now() + CONNECT_WAIT_MS;

    while (Date.now() < deadline) {
      const status = await this.call("status");
      const file = (status.files as StatusFile[]).find((connected) => connected.name === TEST_MCP.file);

      if (file !== undefined) {
        return { status, file };
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

  async #answer(
    tool: string,
    args: ToolResult,
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<Client["callTool"]>>> {
    // An accept keeps the design a baseline_diff compared and reaches no file; baseline_save refuses `file` beside it.
    const reachesNoFile = tool === "baseline_save" && args.accept !== undefined && args.file === undefined;

    if (this.#takesFile.has(tool) && args.file !== TEST_MCP.file && !reachesNoFile) {
      throw new Error(`live tests call ${tool} with file: "${TEST_MCP.file}" only, not ${JSON.stringify(args.file)}.`);
    }

    return await this.#client.callTool(
      { name: tool, arguments: args },
      { timeout: CALL_TIMEOUT_MS, ...(signal === undefined ? {} : { signal }) },
    );
  }
}
