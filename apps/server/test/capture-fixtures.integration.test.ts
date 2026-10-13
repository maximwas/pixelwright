import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeError, OPERATION_SCHEMAS, type OperationRequest } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { resolveTarget } from "../src/bridge/target.ts";

const FIXTURES = fileURLToPath(new URL("../../../packages/core/test/fixtures/", import.meta.url));
const CODE_FILE = fileURLToPath(new URL("../../../.superpowers/live-pairing-code.txt", import.meta.url));
const WAIT_MS = 300_000;

/** The Positivus test file: read only, never changed. */
const POSITIVUS = "Untitled";

const SNAPSHOTS: readonly { file: string; input: OperationRequest<"snapshot"> }[] = [
  {
    file: "positivus-services-row.json",
    input: {
      node: "2:4869",
      css: "all",
    },
  },
  {
    file: "positivus-services-block.json",
    input: {
      node: "2:4868",
      css: "all",
    },
  },
  {
    file: "positivus-hero.json",
    input: {
      node: "2:4785",
      css: "all",
    },
  },
  {
    file: "positivus-landing-top.json",
    input: {
      node: "2:4766",
      depth: 1,
      css: "all",
    },
  },
];

/**
 * Captures the snapshot fixtures core's CSS and XML tests run on, from the Positivus file open in Figma Desktop with
 * the Pixelwright plugin running. Runs only when asked: PIXELWRIGHT_CAPTURE=1 pnpm vitest run --project integration
 * test/capture-fixtures.integration.test.ts
 */
describe.skipIf(process.env.PIXELWRIGHT_CAPTURE === undefined)("Positivus fixtures", () => {
  it(
    "captures the snapshots and the landing's outline",
    async () => {
      const app = await createApp();

      try {
        const deadline = Date.now() + WAIT_MS;
        let shownCode: string | null = null;
        let target: { session: string } | null = null;

        // Until a plugin of this build runs in the Positivus file: an older window answers UNKNOWN_OP, and running
        // the plugin again opens a new session.
        while (target === null && Date.now() < deadline) {
          const code = app.bridge.pairing()?.code ?? null;

          if (code !== null && code !== shownCode) {
            shownCode = code;
            writeFileSync(CODE_FILE, `${code}\n`);
            process.stderr.write(`PAIRING CODE: ${code}\n`);
          }

          target = await readyTarget(app);

          if (target === null) {
            await new Promise((resolve) => setTimeout(resolve, 2_000));
          }
        }

        expect(target, "no plugin of this build in the Positivus file: run Pixelwright there again").not.toBeNull();

        if (target === null) {
          return;
        }

        mkdirSync(FIXTURES, { recursive: true });

        for (const { file, input } of SNAPSHOTS) {
          const snapshot = OPERATION_SCHEMAS.snapshot.output.parse(await app.bridge.request("snapshot", input, target));

          writeFileSync(join(FIXTURES, file), `${JSON.stringify(snapshot, null, 2)}\n`);
        }

        const outline = await app.bridge.request(
          "outline",
          {
            node: "2:4766",
            depth: 2,
          },
          target,
        );

        writeFileSync(join(FIXTURES, "positivus-outline.json"), `${JSON.stringify(outline, null, 2)}\n`);
      } finally {
        await app.close();
      }
    },
    WAIT_MS + 120_000,
  );
});

const RETRY_CODES = new Set(["UNKNOWN_OP", "PLUGIN_NOT_CONNECTED", "PLUGIN_DISCONNECTED", "FILE_NOT_FOUND"]);

/** The Positivus file's session once its plugin answers snapshot; null while none does yet. */
async function readyTarget(app: Awaited<ReturnType<typeof createApp>>): Promise<{ session: string } | null> {
  try {
    const target = resolveTarget(app.bridge.plugins(), POSITIVUS);

    await app.bridge.request(
      "snapshot",
      {
        node: "2:4869",
        depth: 0,
        css: "none",
      },
      target,
    );

    return target;
  } catch (error) {
    if (error instanceof BridgeError && RETRY_CODES.has(error.code)) {
      return null;
    }

    throw error;
  }
}
