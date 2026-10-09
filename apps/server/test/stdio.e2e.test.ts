import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";
import { freePort } from "./helpers/free-port.ts";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

describe("stdio server", () => {
  it("serves status with no plugin connected and keeps stdout clean", async () => {
    const home = await mkdtemp(join(tmpdir(), "pixelwright-e2e-"));
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: {
        ...inherited,
        PIXELWRIGHT_HOME: home,
        PIXELWRIGHT_BRIDGE_PORT: String(await freePort()),
      },
    });
    // A stray stdout line breaks JSON-RPC parsing, and the client reports it here instead of failing a call.
    const transportErrors: Error[] = [];

    transport.onerror = (error) => transportErrors.push(error);

    const client = new Client({
      name: "e2e",
      version: "0.0.0",
    });

    await client.connect(transport);

    try {
      const { tools } = await client.listTools();

      expect(tools.map((tool) => tool.name).sort()).toEqual([
        "node_show",
        "nodes_find",
        "outline",
        "selection_get",
        "status",
      ]);

      for (const tool of tools) {
        // Every tool so far only reads the document (node_show moves the view and the selection, not the file).
        expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      }

      const status = await client.callTool({
        name: "status",
        arguments: {},
      });

      expect(status.structuredContent).toMatchObject({
        server: { role: "owner" },
        files: [],
        probe: null,
        hint: expect.stringContaining("No Figma file is connected"),
      });
      expect(transportErrors).toEqual([]);
    } finally {
      await client.close();
    }
  });
});
