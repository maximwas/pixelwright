import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { decode } from "fast-png";
import { describe, expect, it } from "vitest";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
const OUT = process.env.PIXELWRIGHT_LIVE ?? "";
const WRITE = process.env.PIXELWRIGHT_LIVE_WRITE === "1";
/** Seconds to wait for the plugin to connect with Allow edits on (PIXELWRIGHT_LIVE_WAIT, default 30). */
const WAIT = Number(process.env.PIXELWRIGHT_LIVE_WAIT ?? "30") * 1_000;
/** Maxim's test file ("Test MCP"): anything may be done in it. Nothing is written anywhere else. */
const FILE = process.env.PIXELWRIGHT_LIVE_FILE ?? "Test MCP";

/** What a real build needed to read: made in the test file, read every new way, then taken back. */
const MAKE = String.raw`
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const paint = (name, level) => {
  const style = figma.createPaintStyle();
  style.name = name;
  style.paints = [{ type: "SOLID", color: { r: level, g: level, b: level } }];
  return style;
};
const first = paint("PW check Black", 15 / 255);
const second = paint("PW check Black", 20 / 255);
const frame = figma.createFrame();
frame.name = "PW stage 7 check";
frame.x = -4000;
frame.y = 0;
frame.resize(800, 600);
frame.fills = [];
figma.currentPage.appendChild(frame);
const dot = figma.createRectangle();
dot.name = "Dot";
dot.resize(20, 20);
dot.x = 20;
dot.y = 20;
frame.appendChild(dot);
await dot.setFillStyleIdAsync(second.id);
const blurred = figma.createRectangle();
blurred.name = "Blurred";
blurred.resize(100, 60);
blurred.x = 60;
blurred.y = 20;
blurred.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.6, b: 1 } }];
blurred.effects = [{ type: "LAYER_BLUR", blurType: "PROGRESSIVE", radius: 16, startRadius: 0, startOffset: { x: 0.5, y: 0 }, endOffset: { x: 0.5, y: 1 }, visible: true }];
frame.appendChild(blurred);
const rule = figma.createLine();
rule.name = "Rule";
rule.resize(100, 0);
rule.x = 20;
rule.y = 100;
rule.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
rule.strokeWeight = 1;
rule.strokeAlign = "CENTER";
frame.appendChild(rule);
const card = figma.createFrame();
card.name = "Card";
card.layoutMode = "VERTICAL";
card.resize(297, 120);
card.x = 20;
card.y = 140;
card.fills = [];
frame.appendChild(card);
const title = figma.createText();
title.name = "Title";
title.characters = "Behind\u2028Your";
card.appendChild(title);
title.textAutoResize = "HEIGHT";
title.layoutSizingHorizontal = "FIXED";
title.resize(306, title.height);
const normal = figma.createComponent();
normal.name = "Type=Default";
normal.resize(120, 40);
const hover = figma.createComponent();
hover.name = "Type=Hover";
hover.resize(120, 40);
hover.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
const set = figma.combineAsVariants([normal, hover], frame);
set.name = "PW check Button";
set.x = 400;
set.y = 20;
await normal.setReactionsAsync([{ trigger: { type: "ON_HOVER" }, actions: [{ type: "NODE", destinationId: hover.id, navigation: "CHANGE_TO", transition: { type: "SMART_ANIMATE", easing: { type: "EASE_OUT" }, duration: 0.3 } }] }]);
const button = normal.createInstance();
button.name = "Button";
button.x = 400;
button.y = 200;
frame.appendChild(button);
return { frame: frame.id, dot: dot.id, blurred: blurred.id, rule: rule.id, title: title.id, button: button.id };`;

const TAKE_BACK = `
for (const node of figma.currentPage.findAll((node) => node.name === "PW stage 7 check")) node.remove();
for (const style of await figma.getLocalPaintStylesAsync()) if (style.name === "PW check Black") style.remove();
return "taken back";`;

type Content = { type: string; text?: string; data?: string };

describe.skipIf(OUT === "" || !WRITE)("precise reads on the test file", () => {
  it("reads a progressive blur, a centred stroke, a soft break, overflow, a hover and two Blacks, writes nothing back", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: Object.fromEntries(
        Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
      ),
      stderr: "pipe",
    });
    const client = new Client({
      name: "live-precise",
      version: "0.0.0",
    });
    const log: Record<string, unknown> = {};
    const call = async (name: string, args: Record<string, unknown>) => {
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

      return {
        structured: result.structuredContent as Record<string, unknown> | undefined,
        content,
      };
    };

    await client.connect(transport);
    mkdirSync(OUT, { recursive: true });

    try {
      // The plugin must be this build's (protocol 3) with Allow edits on in the test file.
      for (const until = Date.now() + WAIT; ; ) {
        const files = ((await call("status", {})).structured?.files ?? []) as { name: string; allowEdits: boolean }[];

        if (files.some(({ name, allowEdits }) => name === FILE && allowEdits)) {
          break;
        }

        if (Date.now() > until) {
          throw new Error(`${FILE} is not connected with Allow edits on`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }

      const made = JSON.parse(
        (
          await call("execute", {
            code: MAKE,
            timeout: 20,
          })
        ).content[0]?.text ?? "{}",
      ) as {
        result: Record<string, string>;
        error?: string;
      };

      log.made = made;
      expect(made.error).toBeUndefined();

      const ids = made.result;
      const read = await call("design_read", { node: ids.frame });
      const xml = read.content[0]?.text ?? "";
      const json = JSON.parse(read.content[1]?.text ?? "{}") as { tokens: Record<string, string>; hints: string[] };

      log.xml = xml;
      log.read = json;

      // Only the #141414 Black is used; which of the two is -2 follows their ids, so it is checked against tokens_read.
      const used = Object.entries(json.tokens).find(([, value]) => value === "#141414")?.[0] ?? "";

      expect(used).toMatch(/^--PW-check-Black(-2)?$/);
      expect(xml).toContain(`var(${used})`);
      expect(xml).toContain("blur: progressive from 0px at 50% 0% to 8px at 50% 100%");
      expect(xml).toContain("stroke-align: center");
      expect(xml).toContain("Behind&#8232;Your");
      expect(xml).toContain('$on-hover="change to Type=Hover; smart animate 300ms ease-out"');
      expect(json.hints.join("\n")).toMatch(/Auto line height/);
      expect(json.hints.join("\n")).toMatch(/wider or taller/);

      const inspected = (
        await call("inspect", {
          nodes: [ids.rule, ids.title],
          relativeTo: ids.frame,
        })
      ).structured as {
        layers: {
          box: { width: number; height: number };
          paintedBox?: { y: number; height: number };
          overflow?: { right?: number };
          text?: { lines: { break: string | null }[] };
        }[];
      };

      log.inspect = inspected;
      expect(inspected.layers[0]?.paintedBox?.height).toBeGreaterThan(0);
      expect(inspected.layers[1]?.overflow?.right).toBeCloseTo(9, 0);
      expect(inspected.layers[1]?.text?.lines[0]?.break).toBe("line");

      const shot = await call("screenshot", {
        node: ids.blurred,
        scale: 2,
        effects: false,
        clip: {
          x: 10,
          y: 10,
          width: 40,
          height: 20,
        },
      });
      const image = decode(Buffer.from(shot.content.find((part) => part.type === "image")?.data ?? "", "base64"));

      expect([image.width, image.height]).toEqual([80, 40]);

      // A text paints only its glyphs: its whole box still clips, transparent where nothing paints.
      const titleBox = inspected.layers[1]?.box ?? {
        width: 0,
        height: 0,
      };
      const title = decode(
        Buffer.from(
          (
            await call("screenshot", {
              node: ids.title,
              clip: {
                x: 0,
                y: 0,
                width: titleBox.width,
                height: titleBox.height,
              },
            })
          ).content.find((part) => part.type === "image")?.data ?? "",
          "base64",
        ),
      );

      expect([title.width, title.height]).toEqual([Math.round(titleBox.width), Math.round(titleBox.height)]);

      // Sent back unchanged, the read writes nothing: no $ attribute, soft break or numbered token goes astray.
      const back = (await call("design_apply", { xml })).structured;

      log.roundTrip = back;
      expect(back).toMatchObject({
        created: [],
        changed: [],
      });

      const tokens = (await call("tokens_read", { format: "json" })).structured as {
        notes?: string[];
        tokens?: { styles: { paint: { name: string; token: string; value: string }[] } };
      };
      const blacks = (tokens.tokens?.styles.paint ?? []).filter((style) => style.name === "PW check Black");

      log.blacks = blacks;
      // tokens_read means the same style by the same name as the read did.
      expect(blacks.find((style) => style.value === "#141414")?.token).toBe(used);
      expect(blacks.map((style) => style.token).toSorted()).toEqual(["--PW-check-Black", "--PW-check-Black-2"]);

      expect((tokens.notes ?? []).join("\n")).toMatch(/PW check Black/);
    } finally {
      log.takenBack = await call("execute", {
        code: TAKE_BACK,
        timeout: 20,
      }).then(
        (taken) => taken.content[0]?.text,
        (error: unknown) => String(error),
      );
      writeFileSync(join(OUT, "live-precise.json"), JSON.stringify(log, null, 2));
      await client.close();
    }
  }, 600_000);
});
