// `pnpm try <tool> ['<json>']`: runs one tool call against the built server (dist/bin.mjs) over stdio and prints the
// answer. Written here, not the MCP Inspector CLI, because a call must never reach a file other than "Test MCP" (R-001).
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

/** The only Figma file a try call may touch. */
const TEST_FILE = "Test MCP";

class TryClient {
  readonly #bin = fileURLToPath(new URL("../dist/bin.mjs", import.meta.url));

  /** The process exit code: 1 when the answer is an error. */
  async run(argv: readonly string[]): Promise<number> {
    const { positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
    });
    const [tool, json = "{}"] = positionals;

    if (tool === undefined) {
      throw new Error("Usage: pnpm try <tool> ['<json arguments>']");
    }

    const client = new Client({
      name: "pixelwright-try",
      version: "1.0.0",
    });

    // The server's stderr (its log lines) shows in this terminal; the environment passes through, PIXELWRIGHT_* too.
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [this.#bin],
        env: this.#env(),
        stderr: "inherit",
      }),
    );

    try {
      const answer = await client.callTool({
        name: tool,
        arguments: await this.#pinned(client, tool, JSON.parse(json)),
      });

      process.stdout.write(`${JSON.stringify(answer.structuredContent ?? answer.content, null, 2)}\n`);

      return answer.isError ? 1 : 0;
    } finally {
      await client.close();
    }
  }

  /** The arguments with `file: "Test MCP"` added for a tool that takes a file; any other file is refused. */
  async #pinned(
    client: Client,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { tools } = await client.listTools();
    const takesFile = tools.find(({ name }) => name === tool)?.inputSchema.properties?.file !== undefined;

    if (args.file !== undefined && args.file !== TEST_FILE) {
      throw new Error(`pnpm try works on "${TEST_FILE}" only, not on ${JSON.stringify(args.file)}.`);
    }

    return takesFile
      ? {
        ...args,
        file: TEST_FILE,
      }
      : args;
  }

  #env(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
  }
}

process.exitCode = await new TryClient().run(process.argv.slice(2));
