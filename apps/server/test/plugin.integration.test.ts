import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

/** Where the pairing code goes the moment status shows it, for whoever relays it to the user typing it in Figma. */
const CODE_FILE = join(tmpdir(), "pixelwright-pairing-code.txt");

/** Long enough for a person to read the code and type it into the plugin window. */
const WAIT_MS = 300_000;

interface LiveStatus {
  readonly server?: { readonly role?: string };
  readonly files?: readonly { readonly active: boolean }[];
  readonly pairing?: { readonly code: string; readonly expiresInSeconds: number } | null;
  readonly probe?: { readonly ok: boolean } | null;
}

/**
 * Needs Figma Desktop with the Pixelwright plugin running in a file, and port 18720 free or owned by this test's
 * server. When the plugin is not paired yet, the code is written to CODE_FILE and stderr as soon as status shows it,
 * and the test waits for the user to type it into the plugin window. Prints the upgrade lines (the plugin's Origin).
 */
describe("a plugin running in Figma Desktop", () => {
  it(
    "pairs or proves its key, shows up in status and answers a ping",
    async () => {
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
        const deadline = Date.now() + WAIT_MS;
        let status: LiveStatus = {};
        let shownCode: string | null = null;

        while (Date.now() < deadline) {
          const result = await client.callTool({
            name: "status",
            arguments: { probe: true },
          });

          status = result.structuredContent as LiveStatus;

          // As a peer, this server never sees the plugin's upgrade, so the Origin this check is for would not be logged.
          expect(status, "another Pixelwright process owns port 18720: close it and run again").toMatchObject({
            server: { role: "owner" },
          });

          const code = status.pairing?.code ?? null;

          if (code !== null && code !== shownCode) {
            shownCode = code;
            writeFileSync(CODE_FILE, `${code}\n`);
            process.stderr.write(`PAIRING CODE: ${code} (valid ${status.pairing?.expiresInSeconds} s)\n`);
          }

          if ((status.files?.length ?? 0) > 0 && status.probe?.ok) {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1_000));
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
    },
    WAIT_MS + 30_000,
  );
});
