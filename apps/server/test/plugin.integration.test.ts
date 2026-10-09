import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

/**
 * Needs Figma Desktop with the Pixelwright plugin running in a file, and port 18720 free or owned by this test's
 * server. Prints what the live check has to settle: the plugin iframe's Origin, the file key, the editor type.
 */
describe("a plugin running in Figma Desktop", () => {
  it("connects, shows up in status and answers a ping", async () => {
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: {
        ...inherited,
        PIXELWRIGHT_LOG_LEVEL: "debug",
      },
      stderr: "pipe",
    });
    const log: string[] = [];

    transport.stderr?.on("data", (chunk: Buffer) => log.push(chunk.toString()));

    const client = new Client({
      name: "live-check",
      version: "0.0.0",
    });

    await client.connect(transport);

    try {
      const deadline = Date.now() + 120_000;
      let status: Record<string, unknown> = {};

      while (Date.now() < deadline) {
        const result = await client.callTool({
          name: "status",
          arguments: { probe: true },
        });

        status = result.structuredContent as Record<string, unknown>;

        // As a peer, this server never sees the plugin's upgrade, so the Origin this check is for would not be logged.
        expect(status, "another Pixelwright process owns port 18720: close it and run again").toMatchObject({
          server: { role: "owner" },
        });

        if (Array.isArray(status.files) && status.files.length > 0) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }

      console.log(JSON.stringify(status, null, 2));
      console.log(
        log
          .join("")
          .split("\n")
          .filter((line) => line.includes('"msg":"upgrade"'))
          .join("\n"),
      );
      expect(status).toMatchObject({ probe: { ok: true } });
      expect(status.files).toContainEqual(expect.objectContaining({ active: true }));
    } finally {
      await client.close();
    }
  });
});
