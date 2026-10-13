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

/** The playground file with the Orbit demo (Maxim's test file); capturing only reads it. */
const ORBIT = "Test MCP";

const SNAPSHOTS: readonly { file: string; input: OperationRequest<"snapshot"> }[] = [
  {
    file: "orbit-plans.json",
    input: {
      node: "54:243",
      css: "all",
    },
  },
  {
    file: "orbit-pricing.json",
    input: {
      node: "54:227",
      css: "all",
    },
  },
  {
    file: "orbit-customers.json",
    input: {
      node: "54:434",
      css: "all",
    },
  },
  {
    file: "orbit-desktop-top.json",
    input: {
      node: "54:227",
      depth: 1,
      css: "all",
    },
  },
];

/**
 * Captures the snapshot fixtures core's CSS and XML tests run on, from the Orbit demo open in Figma Desktop with
 * the Pixelwright plugin running. Runs only when asked: PIXELWRIGHT_CAPTURE=1 pnpm vitest run --project integration
 * test/capture-fixtures.integration.test.ts
 */
describe.skipIf(process.env.PIXELWRIGHT_CAPTURE === undefined)("Orbit fixtures", () => {
  it(
    "captures the snapshots",
    async () => {
      const app = await createApp();

      try {
        const deadline = Date.now() + WAIT_MS;
        let shownCode: string | null = null;
        let target: { session: string } | null = null;

        // Until a plugin of this build runs in the Orbit file: an older window answers UNKNOWN_OP, and running
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

        expect(target, "no plugin of this build in the Orbit file: run Pixelwright there again").not.toBeNull();

        if (target === null) {
          return;
        }

        mkdirSync(FIXTURES, { recursive: true });

        for (const { file, input } of SNAPSHOTS) {
          const snapshot = OPERATION_SCHEMAS.snapshot.output.parse(await app.bridge.request("snapshot", input, target));

          writeFileSync(join(FIXTURES, file), `${JSON.stringify(snapshot, null, 2)}\n`);
        }
      } finally {
        await app.close();
      }
    },
    WAIT_MS + 120_000,
  );
});

const RETRY_CODES = new Set(["UNKNOWN_OP", "PLUGIN_NOT_CONNECTED", "PLUGIN_DISCONNECTED", "FILE_NOT_FOUND"]);

/** The Orbit file's session once its plugin answers snapshot; null while none does yet. */
async function readyTarget(app: Awaited<ReturnType<typeof createApp>>): Promise<{ session: string } | null> {
  try {
    const target = resolveTarget(app.bridge.plugins(), ORBIT);

    await app.bridge.request(
      "snapshot",
      {
        node: "54:243",
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
