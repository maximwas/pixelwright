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

/** Two screens of one page, a gradient style, a chip with a hover state, a light/dark theme: made, read, taken back. */
const MAKE = String.raw`
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const gradient = figma.createPaintStyle();
gradient.name = "PW8 Gradient";
gradient.paints = [{ type: "GRADIENT_LINEAR", gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0, a: 1 } }, { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }] }];
const theme = figma.variables.createVariableCollection("PW8 Theme");
const light = theme.modes[0].modeId;
theme.renameMode(light, "Light");
const surface = figma.variables.createVariable("pw8/surface", theme, "COLOR");
surface.setValueForMode(light, { r: 1, g: 1, b: 1, a: 1 });
const screen = (name, x, width) => {
  const frame = figma.createFrame();
  frame.name = name;
  frame.x = x;
  frame.y = -6000;
  frame.resize(width, 600);
  frame.layoutMode = "VERTICAL";
  frame.paddingTop = 13;
  frame.itemSpacing = 16;
  frame.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.6, b: 1 } }];
  figma.currentPage.appendChild(frame);
  for (const part of ["Header", "Hero"]) {
    const child = figma.createFrame();
    child.name = part;
    child.resize(width, 100);
    child.fills = [];
    frame.appendChild(child);
  }
  const title = figma.createText();
  title.name = "Title";
  title.characters = "Hello";
  title.fontSize = 12;
  title.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  frame.appendChild(title);
  return frame;
};
const desktop = screen("PW8 Home – Desktop", -9000, 1440);
const mobile = screen("PW8 Home – Mobile", -7400, 375);
desktop.layoutGrids = [{ pattern: "COLUMNS", alignment: "STRETCH", count: 12, gutterSize: 24, offset: 80, visible: true }];
const button = figma.createRectangle();
button.name = "Buy";
button.resize(120, 40);
desktop.appendChild(button);
await button.setFillStyleIdAsync(gradient.id);
await button.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: mobile.id, navigation: "NAVIGATE", transition: null }] }]);
const panel = figma.createRectangle();
panel.name = "Panel";
panel.resize(200, 80);
panel.fills = [figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 1, g: 1, b: 1 } }, "color", surface)];
desktop.appendChild(panel);
const normal = figma.createComponent();
normal.name = "State=Default";
normal.resize(80, 32);
const hover = figma.createComponent();
hover.name = "State=Hover";
hover.resize(80, 32);
hover.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
const chips = figma.combineAsVariants([normal, hover], figma.currentPage);
chips.name = "PW8 Chip";
chips.x = -9000;
chips.y = -6800;
const chip = normal.createInstance();
chip.name = "Chip";
desktop.appendChild(chip);
return { desktop: desktop.id, mobile: mobile.id, button: button.id, panel: panel.id, chip: chip.id, chips: chips.id, title: desktop.children.find((child) => child.name === "Title").id };`;

const TAKE_BACK = `
for (const node of figma.currentPage.findAll((node) => node.name.startsWith("PW8 "))) node.remove();
for (const style of await figma.getLocalPaintStylesAsync()) if (style.name === "PW8 Gradient") style.remove();
for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) if (collection.name === "PW8 Theme") collection.remove();
return "taken back";`;

type Content = { type: string; text?: string; data?: string };

describe.skipIf(OUT === "" || !WRITE)("stage 8 on the test file", () => {
  it("reads, compares, measures, maps, checks and exports what a second real build needed", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: Object.fromEntries(
        Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
      ),
      stderr: "pipe",
    });
    const client = new Client({
      name: "live-feedback",
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

      log[name] = result.structuredContent ?? content.find((part) => part.type === "text")?.text;

      return {
        structured: result.structuredContent as Record<string, unknown>,
        content,
      };
    };

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

      const { cursor } = (await call("changes_since")).structured as { cursor: number };
      const made = JSON.parse(
        (
          await call("execute", {
            code: MAKE,
            timeout: 25,
          })
        ).content[0]?.text ?? "{}",
      ) as {
        result: Record<string, string>;
        error?: string;
      };

      log.made = made;
      expect(made.error).toBeUndefined();

      const ids = made.result;

      // The gradient style's token has a value; the grid is read.
      const read = await call("design_read", { node: ids.desktop });
      const xml = read.content[0]?.text ?? "";
      const json = JSON.parse(read.content[1]?.text ?? "{}") as { tokens: Record<string, string> };

      expect(json.tokens["--PW8-Gradient"]).toMatch(/linear-gradient/);
      expect(xml).toContain("layout-grid: 12 columns stretch, gutter 24px, margin 80px");

      const inspected = (await call("inspect", { nodes: [ids.button, ids.panel] })).structured as {
        layers: { fills?: { css: string; style?: { token: string }; tokens?: Record<string, string> } }[];
      };

      expect(inspected.layers[0]?.fills?.style?.token).toBe("--PW8-Gradient");
      expect(Object.keys(inspected.layers[1]?.fills?.tokens ?? {})).toEqual(["--pw8-surface"]);

      const measured = (await call("measure", { nodes: [ids.button, ids.panel] })).structured as {
        pairs: { gap: { y: number } }[];
      };

      expect(measured.pairs[0]?.gap.y).toBe(16);

      const diff = (
        await call("nodes_diff", {
          a: ids.desktop,
          b: ids.mobile,
        })
      ).structured as { same: boolean };

      expect(diff.same).toBe(false);
      expect(
        ((await call("variants_read", { node: ids.chip })).structured as { variants: { pseudo?: string }[] })
          .variants[0]?.pseudo,
      ).toBe(":hover");

      const widths = (await call("breakpoints_find", { node: ids.desktop })).structured as { widths: { id: string }[] };

      expect(widths.widths.map((width) => width.id)).toEqual([ids.mobile, ids.desktop]);

      const flows = (await call("flow_read")).structured as { links: { to: { id: string } | null }[] };

      expect(flows.links.some((link) => link.to?.id === ids.mobile)).toBe(true);

      const contrast = (await call("contrast_check", { node: ids.desktop })).structured as {
        texts: { name: string; aa: boolean | null }[];
      };

      expect(contrast.texts.find((text) => text.name === "Title")?.aa).toBe(false);

      const usage = (await call("tokens_usage", { token: "--PW8-Gradient" })).structured as {
        layers: { id: string }[];
      };

      expect(usage.layers.map((layer) => layer.id)).toEqual([ids.button]);

      const audit = (await call("design_audit", { node: ids.desktop })).structured as { notes: string[] };

      expect(audit.notes.join("\n")).toMatch(/13px is off the 4px grid/);

      const fonts = (await call("fonts_check", { node: ids.desktop })).structured as {
        fonts: { family: string; google: boolean | null }[];
      };

      expect(fonts.fonts[0]).toMatchObject({ family: "Inter" });

      const outline = (
        await call("outline", {
          node: ids.desktop,
          depth: 1,
        })
      ).structured as { xml: string };

      expect(outline.xml).toContain('component="PW8 Chip" variant="State=Default"');

      const map = (await call("file_map")).structured as { pages: { nodes: { id: string }[] }[] };

      expect(map.pages.some((page) => page.nodes.some((node) => node.id === ids.desktop))).toBe(true);

      // A render compared with itself, saved first, differs in nothing; one in the file's only mode, set and set back
      // on the layer, renders the same; a mode the collection lacks is named with the ones it has. (The test file's
      // plan allows one mode per collection.)
      const light = join(OUT, "panel-light.png");
      const moded = join(OUT, "panel-moded.png");

      await call("screenshot", {
        node: ids.panel,
        save: light,
      });
      await call("screenshot", {
        node: ids.panel,
        save: moded,
        modes: { "pw8 theme": "light" },
      });

      const same = (
        await call("image_compare", {
          node: ids.panel,
          reference: light,
        })
      ).structured as { rmse: number };
      const inMode = (
        await call("image_compare", {
          node: ids.panel,
          reference: moded,
        })
      ).structured as { rmse: number };

      expect(same.rmse).toBe(0);
      expect(inMode.rmse).toBe(0);
      await expect(
        call("screenshot", {
          node: ids.panel,
          modes: { "PW8 Theme": "Dark" },
        }),
      ).rejects.toThrow(/PW8 Theme has no mode Dark: Light/);

      const webp = (
        await call("assets_export", {
          nodes: [ids.button],
          dir: join(OUT, "assets"),
          format: "WEBP",
          width: 60,
        })
      ).structured as { files: { format: string }[] };

      expect(webp.files[0]?.format).toBe("WEBP");

      await call("node_show", {
        nodes: [ids.desktop],
        zoom: 0.25,
        select: false,
      });

      const view = (await call("viewport_get")).structured as { zoom: number };

      expect(view.zoom).toBeCloseTo(0.25, 2);

      const changes = (await call("changes_since", { cursor })).structured as {
        changes: { id: string; by: string }[];
      };

      expect(changes.changes.find((change) => change.id === ids.desktop)?.by).toBe("pixelwright");
    } finally {
      log.takenBack = await call("execute", {
        code: TAKE_BACK,
        timeout: 20,
      }).then(
        (taken) => taken.content[0]?.text,
        (error: unknown) => String(error),
      );
      writeFileSync(join(OUT, "live-feedback.json"), JSON.stringify(log, null, 2));
      await client.close();
    }
  }, 600_000);
});
