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
 * A card with an annotation pinning width and padding, a measurement between its two children, Motion on both (a
 * manual opacity track, and Figma's Position style starting 0.3 s in), and a component with a slot and its instance.
 * Figma fills a style's keyframes in after the call that applies it, hence the wait.
 */
const MAKE = `
const card = figma.createFrame();
card.name = "PW10 Card";
card.x = -9000;
card.y = -8000;
card.layoutMode = "VERTICAL";
card.primaryAxisSizingMode = "AUTO";
card.paddingTop = 16;
card.paddingRight = 16;
card.paddingBottom = 16;
card.paddingLeft = 16;
card.itemSpacing = 12;
card.resize(240, card.height);
figma.currentPage.appendChild(card);
const part = (name) => {
  const rectangle = figma.createRectangle();
  rectangle.name = name;
  rectangle.resize(208, 40);
  card.appendChild(rectangle);
  return rectangle;
};
const top = part("Top");
const bottom = part("Bottom");
card.annotations = [{ label: "Card API", properties: [{ type: "width" }, { type: "padding" }] }];
figma.currentPage.addMeasurement({ node: top, side: "BOTTOM" }, { node: bottom, side: "TOP" }, { freeText: "gap" });
let motion = false;
if (figma.motion !== undefined) {
  const float = (value) => ({ type: "FLOAT", value });
  top.applyManualKeyframeTrack({ type: "PROPERTY", name: "OPACITY" }, {
    baseValue: float(1),
    keyframes: [
      { timelinePosition: 0, value: float(0), easing: { type: "EASE_OUT" } },
      { timelinePosition: 0.6, value: float(1), easing: { type: "EASE_OUT" } },
    ],
  });
  bottom.applyAnimationStyle("Position", { duration: 0.6, timelineOffset: 0.3 });
  motion = true;
}
const panel = figma.createComponent();
panel.name = "PW10 Panel";
panel.x = -9000;
panel.y = -8400;
panel.layoutMode = "VERTICAL";
panel.resize(200, 100);
panel.createSlot().name = "Content";
const instance = panel.createInstance();
instance.name = "PW10 Panel instance";
instance.x = -8700;
instance.y = -8400;
await new Promise((resolve) => setTimeout(resolve, 1500));
return { card: card.id, top: top.id, bottom: bottom.id, instance: instance.id, motion };`;

const TAKE_BACK = `
const made = figma.currentPage.children.filter((node) => node.name.startsWith("PW10 "));
for (const node of made.filter((node) => node.type === "INSTANCE")) node.remove();
for (const node of made.filter((node) => !node.removed)) node.remove();
return "taken back";`;

type Content = { type: string; text?: string };

describe.skipIf(OUT === "" || !WRITE)("stage 10 on the test file", () => {
  it("reads DTCG tokens, pins, measurements and Motion, and fills a slot", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: Object.fromEntries(
        Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
      ),
      stderr: "pipe",
    });
    const client = new Client({
      name: "live-stage10",
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

      // DTCG: Orbit's one mode is a tree of its own, styles another.
      const tokens = (await call("tokens_read", { format: "dtcg" })).structured as {
        dtcg: Record<string, { color?: { ink?: { $value: { hex: string } } } }>;
      };

      expect(Object.keys(tokens.dtcg)).toEqual(expect.arrayContaining(["orbit", "styles"]));
      expect(tokens.dtcg.orbit?.color?.ink?.$value.hex).toBe("#14161F");

      const made = JSON.parse(
        (
          await call("execute", {
            code: MAKE,
            timeout: 25,
          })
        ).content[0]?.text ?? "{}",
      ) as {
        result: { card: string; top: string; bottom: string; instance: string; motion: boolean };
        error?: string;
      };

      log.made = made;
      expect(made.error).toBeUndefined();

      const ids = made.result;
      const card = await read(ids.card);

      expect(card.xml).toContain('note="Card API" $pins="width, padding"');
      expect(card.json.measurements).toEqual([
        {
          from: `${ids.top} bottom`,
          to: `${ids.bottom} top`,
          px: 12,
          text: "gap",
        },
      ]);

      if (ids.motion) {
        const motion = card.json.motion as { css: string };

        expect(card.xml).toContain('$motion="opacity 0→1; 0–0.6s ease-out"');
        expect(card.xml).toMatch(/\$motion="Position: translate-x [^"]*0\.3–0\.9s ease-out"/);
        expect(motion.css).toContain("@keyframes top {");
        expect(motion.css).toMatch(/\.bottom \{ animation: bottom [\d.]+s linear both; \}/);
      } else {
        log.motionSkipped = "figma.motion is not in this Figma";
      }

      await unchanged(card.xml);

      // A slot: the instance's is filled through design_apply, read back, and the read sent back changes nothing.
      const panel = await read(ids.instance);
      const slot = /<Slot id="([^"]+)"/.exec(panel.xml)?.[1];

      expect(slot).toBeDefined();

      const filled = (
        await call("design_apply", {
          xml: `<Slot id="${slot}"><Text name="PW10 Filled">Filled</Text></Slot>`,
        })
      ).structured as { created: unknown[]; errors: unknown[] };

      expect(filled.errors).toEqual([]);
      expect(filled.created).toHaveLength(1);

      const back = await read(ids.instance);

      expect(back.xml).toContain(">Filled</Text>");
      await unchanged(back.xml);
    } finally {
      log.takenBack = await call("execute", {
        code: TAKE_BACK,
        timeout: 20,
      }).then(
        (taken) => taken.content[0]?.text,
        (error: unknown) => String(error),
      );
      writeFileSync(join(OUT, "live-stage10.json"), JSON.stringify(log, null, 2));
      await client.close();
    }
  }, 600_000);
});
