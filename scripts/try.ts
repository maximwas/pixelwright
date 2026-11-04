// `pnpm try [--hold <s> [--every <s>]] <tool> ['<json>']`: runs one tool call against the built server (dist/bin.mjs)
// over stdio and prints the answer; --hold keeps the server up that long afterwards, so its bridge can be probed or a
// code typed, and --every repeats the call that often while it holds, so the answer can be watched change.
// Written here, not the MCP Inspector CLI, because a call must never reach a file other than "Test MCP" (R-001).
import { setTimeout as sleep } from "node:timers/promises";
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
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { hold: { type: "string" }, every: { type: "string" } },
    });
    const [tool, json = "{}"] = positionals;
    const holdSeconds = Number(values.hold ?? 0);
    const everySeconds = values.every === undefined ? null : Number(values.every);

    if (tool === undefined || !(holdSeconds >= 0) || (everySeconds !== null && !(everySeconds > 0))) {
      throw new Error("Usage: pnpm try [--hold <seconds> [--every <seconds>]] <tool> ['<json arguments>']");
    }

    const client = new Client({ name: "pixelwright-try", version: "1.0.0" });

    // The server's stderr (its log lines) shows in this terminal; the environment passes through, PIXELWRIGHT_* too.
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [this.#bin], env: this.#env(), stderr: "inherit" }),
    );

    try {
      const args = await this.#pinned(client, tool, JSON.parse(json));
      const call = async () => {
        const answer = await client.callTool({ name: tool, arguments: args });

        // A tool without structuredContent (design_read) prints its text blocks as they are: its XML reads as XML.
        const shown =
          answer.structuredContent === undefined
            ? (answer.content as { readonly text?: string }[]).map(({ text }) => text ?? "").join("\n")
            : JSON.stringify(answer.structuredContent, null, 2);

        process.stdout.write(`${shown}\n`);

        return answer;
      };
      const answer = await call();

      await this.#hold(holdSeconds, everySeconds, call);

      return answer.isError ? 1 : 0;
    } finally {
      await client.close();
    }
  }

  /** Keeps the server up for `holdSeconds`, calling again every `everySeconds` when given. */
  async #hold(
    holdSeconds: number,
    everySeconds: number | null,
    call: () => Promise<unknown>,
  ): Promise<void> {
    const step = everySeconds ?? holdSeconds;

    if (holdSeconds > 0) {
      process.stderr.write(`Holding the server for ${holdSeconds} s.\n`);
    }

    for (let held = step; holdSeconds > 0 && held <= holdSeconds; held += step) {
      await sleep(step * 1000);

      if (everySeconds !== null) {
        await call();
      }
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

    return takesFile && !this.#readsNoLayer(tool, args) ? { ...args, file: TEST_FILE } : args;
  }

  /**
   * baseline_save's accept and its `code` alone read no layer: accept refuses `file`, and `code` with `file` reads the
   * layer again instead of changing the list. An accept is held by the server that gave it, so it is tried in one
   * session (the live test), not across two try runs.
   */
  #readsNoLayer(tool: string, args: Record<string, unknown>): boolean {
    // shortcut: `code` alone for a name not saved yet reads the active file's selection; the dev plugin runs in Test MCP only.
    const codeAlone = args.code !== undefined && args.node === undefined && args.replace !== true;

    return tool === "baseline_save" && (args.accept !== undefined || codeAlone);
  }

  #env(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
  }
}

process.exitCode = await new TryClient().run(process.argv.slice(2));
