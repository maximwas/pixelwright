import { spawn } from "node:child_process";
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

/**
 * A frame marked ready for dev holding an instance of Orbit's Plan Card: one of its feature texts edited on the
 * instance (an override no property carries), its Popular badge hidden through the component's boolean property.
 */
const MAKE = `
const main = await figma.getNodeByIdAsync("54:202");
const frame = figma.createFrame();
frame.name = "PW105 Ready";
frame.x = -9000;
frame.y = -8000;
frame.resize(480, 520);
figma.currentPage.appendChild(frame);
frame.devStatus = { type: "READY_FOR_DEV" };
const card = main.createInstance();
frame.appendChild(card);
const feature = card.findOne((node) => node.type === "TEXT" && node.characters === "Unlimited projects");
await figma.loadFontAsync(feature.fontName);
feature.characters = "PW105 changed";
const popular = Object.keys(card.componentProperties).find((key) => key.startsWith("Popular"));
card.setProperties({ [popular]: false });
return { frame: frame.id, card: card.id, feature: feature.id };`;

const TAKE_BACK = `
for (const node of figma.currentPage.children.filter((node) => node.name.startsWith("PW105 "))) node.remove();
return "taken back";`;

type Content = { type: string; text?: string };

describe.skipIf(OUT === "" || !WRITE)("stage 10.5 on the test file", () => {
  it("reads overrides and dev status, saves a version, and logs the calls", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: Object.fromEntries(
        Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
      ),
      stderr: "pipe",
    });
    const client = new Client({
      name: "live-stage10-5",
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

      log[name] = result.structuredContent ?? content.map((part) => part.text);

      return {
        structured: result.structuredContent as Record<string, unknown>,
        content,
      };
    };
    const read = async (node: string) => {
      const { content } = await call("design_read", {
        node,
        code: false,
      });

      return {
        xml: content[0]?.text ?? "",
        json: JSON.parse(content[1]?.text ?? "{}") as Record<string, unknown>,
      };
    };
    const unchanged = async (xml: string) =>
      expect((await call("design_apply", { xml })).structured).toEqual({
        created: [],
        changed: [],
        errors: [],
        dryRun: false,
      });

    await client.connect(transport);
    mkdirSync(OUT, { recursive: true });

    try {
      for (const until = Date.now() + WAIT; ; ) {
        const files = ((await call("status")).structured?.files ?? []) as { name: string; allowEdits: boolean }[];

        if (files.some(({ name, allowEdits }) => name === FILE && allowEdits)) {
          break;
        }

        if (Date.now() > until) {
          throw new Error(`${FILE} is not connected with Allow edits on`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }

      const logs = spawn(process.execPath, [entry, "logs"], { stdio: ["ignore", "pipe", "pipe"] });
      let followed = "";

      logs.stdout.on("data", (chunk: Buffer) => {
        followed += chunk.toString("utf8");
      });

      const made = JSON.parse(
        (
          await call("execute", {
            code: MAKE,
            timeout: 25,
          })
        ).content[0]?.text ?? "{}",
      ) as {
        result: { frame: string; card: string; feature: string };
        error?: string;
      };

      log.made = made;
      expect(made.error).toBeUndefined();

      const ids = made.result;
      const outline = (await call("outline", { depth: 1 })).structured as { xml: string };
      const map = (await call("file_map")).structured as { pages: { nodes: { id: string; devStatus?: string }[] }[] };

      expect(outline.xml).toMatch(new RegExp(`id="${ids.frame}" name="PW105 Ready"[^>]* dev="ready"`));
      expect(map.pages.flatMap((page) => page.nodes).find((node) => node.id === ids.frame)?.devStatus).toBe("ready");

      const card = await read(ids.card);
      const line = (id: string) => card.xml.split("\n").find((row) => row.includes(`id="${id}"`)) ?? "";

      expect(card.xml.split("\n")[0]).toContain('$dev="ready for dev"');
      expect(line(ids.feature)).toContain('$override="text"');
      expect(card.xml).not.toMatch(/name="Badge"[^>]*\$override/);
      await unchanged(card.xml);

      const renamed = (
        await call("design_apply", {
          xml: `<Frame id="${ids.frame}" name="PW105 Ready, renamed"/>`,
          version: "PW105 live check",
        })
      ).structured as { changed: string[]; version?: { id: string | null; title: string } };

      expect(renamed.changed).toEqual([ids.frame]);
      expect(renamed.version?.title).toBe("PW105 live check");
      expect(renamed.version?.id).toEqual(expect.any(String));

      for (const until = Date.now() + 5_000; !followed.includes("tool design_apply"); ) {
        if (Date.now() > until) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      logs.kill();
      log.followed = followed.split("\n").slice(-20);
      expect(followed).toMatch(/tool design_read/);
      expect(followed).toMatch(/tool design_apply/);
    } finally {
      log.takenBack = await call("execute", {
        code: TAKE_BACK,
        timeout: 20,
      }).then(
        (taken) => taken.content[0]?.text,
        (error: unknown) => String(error),
      );
      writeFileSync(join(OUT, "live-stage10-5.json"), JSON.stringify(log, null, 2));
      await client.close();
    }
  }, 600_000);
});
