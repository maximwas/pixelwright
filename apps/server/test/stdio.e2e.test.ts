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
        "assets_export",
        "breakpoints_find",
        "changes_since",
        "code_connect_read",
        "components_read",
        "contrast_check",
        "design_apply",
        "design_read",
        "execute",
        "flow_read",
        "guide",
        "image_compare",
        "inspect",
        "measure",
        "node_show",
        "nodes_delete",
        "nodes_diff",
        "nodes_find",
        "outline",
        "screenshot",
        "selection_get",
        "selection_wait",
        "status",
        "tokens_apply",
        "tokens_read",
        "tokens_usage",
        "variants_read",
        "viewport_get",
      ]);

      for (const tool of tools) {
        // The writing tools say so, so clients ask first (node_show moves the view, not the file).
        const writes = ["design_apply", "execute", "nodes_delete", "tokens_apply"].includes(tool.name);

        expect(tool.annotations?.readOnlyHint, tool.name).toBe(!writes);
        expect(tool.annotations?.destructiveHint ?? false, tool.name).toBe(writes);
        // A tool that returns an image has no outputSchema: Claude Code would show only structuredContent and drop it.
        expect(tool.outputSchema === undefined, tool.name).toBe(["design_read", "screenshot"].includes(tool.name));
      }

      // The guide teaches only tools that exist: every tool-like name in a topic is a registered tool.
      const names = new Set(tools.map((tool) => tool.name));
      const index = (
        await client.callTool({
          name: "guide",
          arguments: {},
        })
      ).structuredContent as {
        topics: { name: string }[];
      };

      expect(index.topics.map((topic) => topic.name)).toEqual([
        "workflow",
        "xml",
        "tokens",
        "assets",
        "write",
        "code-connect",
        "email",
      ]);

      for (const { name } of index.topics) {
        const topic = (
          await client.callTool({
            name: "guide",
            arguments: { topic: name },
          })
        ).structuredContent as {
          markdown: string;
        };

        expect(topic.markdown.length, name).toBeGreaterThan(500);

        for (const [, mentioned] of topic.markdown.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)) {
          expect(names.has(mentioned ?? ""), `${name} mentions ${mentioned}`).toBe(true);
        }
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
