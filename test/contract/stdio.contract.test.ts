import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { build } from "tsdown";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The bundle as `pnpm build` makes it, run as an MCP client runs it. It is built under node_modules/.cache, where its
 * external dependencies resolve, and never into dist/, which a registered dev server may be running from.
 */
class BuiltServer {
  readonly root = fileURLToPath(new URL("../../node_modules/.cache/pixelwright-stdio/", import.meta.url));
  readonly home = mkdtempSync(join(tmpdir(), "pixelwright-stdio-"));
  readonly errors: Error[] = [];
  readonly client = new Client({ name: "stdio-contract", version: "1.0.0" });

  async build(): Promise<void> {
    await build({ outDir: join(this.root, "dist"), logLevel: "silent" });
  }

  async connect(): Promise<void> {
    const env = { PATH: process.env.PATH ?? "", PIXELWRIGHT_HOME: this.home, PIXELWRIGHT_PLUGIN_BRIDGE: "off" };

    // A line on stdout that is not JSON-RPC reaches the client as an error here.
    this.client.onerror = (error) => this.errors.push(error);
    await this.client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(this.root, "dist", "bin.mjs")],
        env,
        stderr: "ignore",
      }),
    );
  }

  logLines(): Record<string, unknown>[] {
    return readFileSync(join(this.home, "logs", "pixelwright.log"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }
}

describe("the built server over stdio", () => {
  const server = new BuiltServer();

  beforeAll(async () => {
    await server.build();
    await server.connect();
  }, 30_000);

  it("initializes, lists status and answers it, with nothing but MCP on stdout", async () => {
    const { tools } = await server.client.listTools();
    const answer = await server.client.callTool({ name: "status", arguments: { probe: false } });

    expect(server.client.getServerVersion()?.name).toBe("pixelwright-new");
    expect(tools.map(({ name }) => name)).toEqual([
      "status",
      "selection_get",
      "node_show",
      "selection_wait",
      "changes_since",
      "file_map",
      "viewport_get",
      "nodes_find",
      "outline",
      "screenshot",
      "design_read",
      "image_compare",
      "styles_compare",
      "inspect",
      "measure",
      "nodes_diff",
      "breakpoints_find",
      "flow_read",
      "variants_read",
      "fonts_check",
      "execute",
      "assets_export",
    ]);
    expect(answer.structuredContent).toMatchObject({ server: { role: "disabled" } });
    expect(server.errors).toEqual([]);
  });

  it("writes the call to the shared log with its callId and ms, and shuts down when stdin ends", async () => {
    await server.client.close();

    const lines = server.logLines();

    expect(lines).toContainEqual(
      expect.objectContaining({
        msg: "tool status",
        tool: "status",
        callId: expect.any(String),
        ms: expect.any(Number),
      }),
    );
    expect(lines.at(-1)).toMatchObject({ msg: "shutting down", reason: "stdin closed" });
  });
});
