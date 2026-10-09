import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
const OUT = process.env.PIXELWRIGHT_LIVE ?? "";

/** The Positivus test file: Maxim's test file, anything may be done in it. */
const FILE = "Untitled";

/**
 * Calls the read tools through MCP against the plugin running in the Positivus file and writes every result under
 * PIXELWRIGHT_LIVE (a folder): PIXELWRIGHT_LIVE=/tmp/live pnpm vitest run --project integration test/live-tools.
 * Nothing in the file changes; node_show moves the selection and the view.
 */
describe.skipIf(OUT === "")("the read tools on the Positivus file", () => {
  it("outline, nodes_find, design_read with assets and a screenshot", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: Object.fromEntries(
        Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
      ),
      stderr: "pipe",
    });
    const client = new Client({
      name: "live-tools",
      version: "0.0.0",
    });

    await client.connect(transport);
    mkdirSync(OUT, { recursive: true });

    try {
      for (let tries = 0; tries < 30; tries++) {
        const status = (
          await client.callTool({
            name: "status",
            arguments: {},
          })
        ).structuredContent as {
          files?: unknown[];
        };

        if ((status.files?.length ?? 0) > 0) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }

      const calls: [string, string, Record<string, unknown>][] = [
        [
          "outline",
          "outline.json",
          {
            node: "2:4766",
            depth: 1,
            file: FILE,
          },
        ],
        [
          "outline",
          "pages.json",
          {
            node: "0:0",
            file: FILE,
          },
        ],
        [
          "nodes_find",
          "find.json",
          {
            text: "Learn more",
            file: FILE,
          },
        ],
        [
          "design_read",
          "design-row.json",
          {
            node: "2:4869",
            assetsDir: join(OUT, "assets"),
            file: FILE,
          },
        ],
        [
          "design_read",
          "design-hero.json",
          {
            node: "2:4785",
            assetsDir: join(OUT, "assets"),
            file: FILE,
          },
        ],
        [
          "design_read",
          "design-landing.json",
          {
            node: "2:4766",
            maxChars: 30_000,
            file: FILE,
          },
        ],
        [
          "screenshot",
          "screenshot.json",
          {
            node: "2:4868",
            file: FILE,
          },
        ],
        [
          "node_show",
          "show.json",
          {
            node: "2:4875",
            file: FILE,
          },
        ],
        ["selection_get", "selection.json", { file: FILE }],
      ];

      for (const [name, out, args] of calls) {
        const started = Date.now();
        const result = await client.callTool({
          name,
          arguments: args,
        });
        const content = (result.content as { type: string; text?: string; data?: string }[]).map((block) =>
          block.type === "image"
            ? {
                type: "image",
                bytes: Buffer.from(block.data ?? "", "base64").length,
              }
            : block,
        );

        writeFileSync(
          join(OUT, out),
          JSON.stringify(
            {
              ms: Date.now() - started,
              isError: result.isError,
              content,
              structured: result.structuredContent,
            },
            null,
            2,
          ),
        );
        expect(result.isError, `${name} ${out}`).not.toBe(true);
      }
    } finally {
      await client.close();
    }
  }, 180_000);
});
