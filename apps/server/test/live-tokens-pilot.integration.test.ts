import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
const OUT = process.env.PIXELWRIGHT_LIVE ?? "";
const WRITE = process.env.PIXELWRIGHT_LIVE_WRITE === "1";
/** Seconds to wait for the plugin to connect with Allow edits on (PIXELWRIGHT_LIVE_WAIT, default 30). */
const WAIT = Number(process.env.PIXELWRIGHT_LIVE_WAIT ?? "30") * 1_000;
/** Maxim's test file ("Test MCP"): anything may be done in it. Nothing is written anywhere else. */
const FILE = process.env.PIXELWRIGHT_LIVE_FILE ?? "Test MCP";

/** A collection the check makes and takes back: a colour in two modes, a length, and an alias to the colour. */
const PILOT = {
  name: "PW Pilot",
  modes: ["Light", "Dark"],
  variables: [
    {
      name: "pw/brand",
      values: {
        Light: "#3B2FD9",
        Dark: "color-mix(in srgb, #3B2FD9 50%, transparent)",
      },
    },
    {
      name: "pw/gap",
      values: {
        Light: "12px",
        Dark: "16px",
      },
    },
    {
      name: "pw/ink",
      values: {
        Light: "var(--pw-brand)",
        Dark: "var(--pw-brand)",
      },
    },
  ],
};

const TAKE_BACK = `
const made = (await figma.variables.getLocalVariableCollectionsAsync()).filter((collection) => collection.name.startsWith("PW Pilot"));
for (const collection of made) collection.remove();
return made.length;`;

type Content = { type: string; text?: string };
type Applied = { created: unknown[]; updated: unknown[]; errors: unknown[]; dryRun: boolean; version?: unknown };

describe.skipIf(OUT === "" || !WRITE)("the tokens pilot on the test file", () => {
  it("reads every format, writes nothing back, makes and finds a collection, and finds a style's layers", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: Object.fromEntries(
        Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
      ),
      stderr: "pipe",
    });
    const client = new Client({
      name: "live-tokens-pilot",
      version: "0.0.0",
    });
    const log: Record<string, unknown> = {};
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({
        name,
        arguments: {
          file: FILE,
          ...args,
        },
      });
      const content = result.content as Content[];

      if (result.isError) {
        throw new Error(`${name}: ${content[0]?.text ?? ""}`);
      }

      log[`${name} ${Object.keys(log).length}`] = result.structuredContent ?? content.map((part) => part.text);

      return result.structuredContent as Record<string, unknown>;
    };

    await client.connect(transport);
    mkdirSync(OUT, { recursive: true });

    try {
      for (const until = Date.now() + WAIT; ; ) {
        const files = ((await call("status")).files ?? []) as { name: string; allowEdits: boolean }[];

        if (files.some(({ name, allowEdits }) => name === FILE && allowEdits)) {
          break;
        }

        if (Date.now() > until) {
          throw new Error(`${FILE} is not connected with Allow edits on`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }

      const css = await call("tokens_read", { format: "css" });
      const json = await call("tokens_read", { format: "json" });
      const dtcg = await call("tokens_read", { format: "dtcg" });

      expect(css.css).toEqual(expect.stringContaining(":root {"));
      expect(Object.keys(dtcg.dtcg as object)).toContain("styles");

      const tokens = json.tokens as { styles: { paint: { token: string }[] } };
      // tokens_read's own JSON fed back: nothing to write, so no version is saved either.
      const back = (await call("tokens_apply", {
        ...tokens,
        version: "PW pilot live check",
      })) as Applied;

      expect(back).toEqual({
        created: [],
        updated: [],
        errors: [],
        dryRun: false,
      });

      const checked = (await call("tokens_apply", {
        collections: [PILOT],
        dryRun: true,
      })) as Applied;

      expect(checked.errors).toEqual([]);
      expect(checked.created).toHaveLength(6);

      const made = (await call("tokens_apply", { collections: [PILOT] })) as Applied;

      expect(made.errors).toEqual([]);
      expect(made.created).toEqual(checked.created);

      const pilot = await call("tokens_read", {
        format: "json",
        collections: ["PW Pilot"],
      });
      const written = (pilot.tokens as { collections: { variables: { token: string; values: object }[] }[] })
        .collections[0];

      expect(written?.variables.map((variable) => variable.token)).toEqual(["--pw-brand", "--pw-gap", "--pw-ink"]);
      expect(written?.variables[2]?.values).toEqual({
        Light: "var(--pw-brand)",
        Dark: "var(--pw-brand)",
      });
      expect(
        (await call("tokens_apply", {
          ...(pilot.tokens as object),
          styles: undefined,
        })) as Applied,
      ).toMatchObject({
        created: [],
        updated: [],
        errors: [],
      });

      const [style] = tokens.styles.paint;

      if (style !== undefined) {
        const usage = await call("tokens_usage", { token: style.token });

        expect(usage.kind).toBe("paint style");
      }
    } finally {
      log.takenBack = await call("execute", {
        code: TAKE_BACK,
        timeout: 20,
      }).then(
        (taken) => taken,
        (error: unknown) => String(error),
      );
      writeFileSync(join(OUT, "live-tokens-pilot.json"), JSON.stringify(log, null, 2));
      await client.close();
    }
  }, 600_000);
});
