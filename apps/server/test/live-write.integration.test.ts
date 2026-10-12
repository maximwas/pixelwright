import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";
import { blankPng, pixel } from "./helpers/images.ts";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
const OUT = process.env.PIXELWRIGHT_LIVE ?? "";
const WRITE = process.env.PIXELWRIGHT_LIVE_WRITE === "1";
/** Seconds to wait for the user to switch Allow edits on before the writes (PIXELWRIGHT_LIVE_WAIT, default none). */
const WAIT = Number(process.env.PIXELWRIGHT_LIVE_WAIT ?? "0") * 1_000;

/** The Positivus test file: Maxim's test file, anything may be done in it. Writes go nowhere else. */
// PIXELWRIGHT_LIVE_FILE when the file was renamed (it was, to "Test MCP", on 2026-10-12).
const FILE = process.env.PIXELWRIGHT_LIVE_FILE ?? "Untitled";

/** A Positivus-like card made from XML with the file's library styles and fonts. */
const CARD = `<Frame name="Pixelwright check card" display="flex" flex-direction="column" gap="16px" padding="40px" border-radius="45px" background="var(--Grey)" border="1px solid var(--Dark)" box-shadow="0 5px 0 0 #191A23">
  <Text textStyle="h3" color="var(--Black)">Written by Pixelwright</Text>
  <Text width="320px" textStyle="p" color="var(--Dark)">A card made from XML, with the file's own styles.</Text>
</Frame>`;

/** S1: is a layer's opacity, and its inner shadow, in what Figma exports? A faded red square with a black inner rim. */
const PROBE =
  '<Rectangle name="Pixelwright S1 probe" width="40px" height="40px" background="#F00" opacity="0.5" box-shadow="inset 0 0 0 4px #000"/>';

type Call = (name: string, args: Record<string, unknown>) => Promise<{ structured: unknown; text: string }>;

/** The live check's tokens: a collection of its own, two modes, an alias, and a style of each kind. */
const TOKENS = {
  collections: [
    {
      name: "Pixelwright check",
      modes: ["Light", "Dark"],
      variables: [
        {
          name: "pixelwright/accent",
          values: {
            Light: "#0D99FF",
            Dark: "#7CC4FA",
          },
        },
        {
          name: "pixelwright/gap",
          values: {
            Light: "12px",
            Dark: "12px",
          },
        },
        {
          name: "pixelwright/link",
          values: {
            Light: "var(--pixelwright-accent)",
            Dark: "var(--pixelwright-accent)",
          },
        },
      ],
    },
  ],
  styles: {
    paint: [
      {
        name: "Pixelwright check/paint",
        value: "#0D99FF",
      },
    ],
    text: [
      {
        name: "Pixelwright check/text",
        value: "500 20px/normal 'Space Grotesk'",
      },
    ],
    effect: [
      {
        name: "Pixelwright check/effect",
        value: "0 5px 0 0 #191A23",
      },
    ],
  },
};

/** Takes the check's tokens back: tokens_apply never deletes. */
const CLEAN_TOKENS = `
for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) {
  if (collection.name === "Pixelwright check") collection.remove();
}
const styles = [
  ...(await figma.getLocalPaintStylesAsync()),
  ...(await figma.getLocalTextStylesAsync()),
  ...(await figma.getLocalEffectStylesAsync()),
];
for (const style of styles) {
  if (style.name.startsWith("Pixelwright check/")) style.remove();
}
return "cleaned";`;

/**
 * design_apply and nodes_delete against the plugin in the Positivus file, opt-in twice: PIXELWRIGHT_LIVE=<dir> for the
 * results and PIXELWRIGHT_LIVE_WRITE=1 for writing. The round trip and the dry run write nothing; with Allow edits on in
 * the plugin window it also probes the export (S1), makes a card and edits an instance's text, and takes all of it
 * back (the card and probe deleted, the text restored).
 */
describe.skipIf(OUT === "" || !WRITE)("design_apply on the Positivus file", () => {
  it(
    "round trip, dry run, then (with Allow edits) the export probe, a card and an instance text",
    async () => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [entry],
        env: Object.fromEntries(
          Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined),
        ),
        stderr: "pipe",
      });
      const client = new Client({
        name: "live-write",
        version: "0.0.0",
      });
      const log: Record<string, unknown> = {};
      // What the run made or changed, taken back in finally whatever failed: layers to delete, texts to restore.
      const made: string[] = [];
      const texts: [string, string][] = [];
      let tokensMade = false;
      const call: Call = async (name, args) => {
        const result = await client.callTool({
          name,
          arguments: {
            file: FILE,
            ...args,
          },
        });
        const text = (result.content as { type: string; text?: string }[])[0]?.text ?? "";

        if (result.isError) {
          throw new Error(`${name}: ${text}`);
        }

        return {
          structured: result.structuredContent,
          text,
        };
      };

      await client.connect(transport);
      mkdirSync(OUT, { recursive: true });

      try {
        const editsOn = async () => {
          const { structured } = await call("status", {});
          const file = (structured as { files: { name: string; allowEdits: boolean }[] }).files.find(
            ({ name }) => name === FILE,
          );

          return file?.allowEdits;
        };
        let allowEdits = false;

        for (let tries = 0; tries < 30; tries++) {
          const on = await editsOn();

          if (on !== undefined) {
            allowEdits = on;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }

        // The round trip: the Services row read and sent back writes nothing (it needs no Allow edits).
        const row = (await call("design_read", { node: "2:4869" })).text;
        const back = (await call("design_apply", { xml: row })).structured;

        log.roundTrip = back;
        expect(back).toEqual({
          created: [],
          changed: [],
          errors: [],
          dryRun: false,
        });

        // The card checked against the file's styles and fonts without writing.
        const checked = (
          await call("design_apply", {
            xml: CARD,
            dryRun: true,
          })
        ).structured as { errors: unknown[] };

        log.dryRun = checked;
        expect(checked.errors).toEqual([]);

        for (const until = Date.now() + WAIT; !allowEdits && Date.now() < until; ) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          allowEdits = (await editsOn()) ?? false;
        }

        log.allowEdits = allowEdits;

        if (!allowEdits) {
          return;
        }

        // S1: the probe exported as PNG at 1x and as SVG.
        const probe = (await call("design_apply", { xml: PROBE })).structured as { created: { id: string }[] };
        const probeId = probe.created[0]?.id ?? "";

        made.push(probeId);

        const exported = (
          await call("assets_export", {
            nodes: [probeId],
            format: "PNG",
            scale: 1,
            dir: join(OUT, "s1"),
          })
        ).structured as { files: { path: string }[] };
        const svg = (
          await call("assets_export", {
            nodes: [probeId],
            format: "SVG",
            dir: join(OUT, "s1"),
          })
        ).structured as { files: { path: string }[] };
        const png = readFileSync(exported.files[0]?.path ?? "");

        log.s1 = {
          centre: pixel(png, 20, 20),
          rim: pixel(png, 1, 20),
          svg: readFileSync(svg.files[0]?.path ?? "", "utf8").slice(0, 2_000),
        };

        // A card in a free-form board beside the page's layers: made, looked at, widened (its height still hugs).
        const board = (
          await call("design_apply", {
            xml: `<Frame name="Pixelwright check" width="900px" height="600px" background="#FFF">${CARD.replace(
              "<Frame name=",
              '<Frame position="absolute" left="40px" top="40px" name=',
            )}</Frame>`,
          })
        ).structured as {
          created: { id: string; tag: string }[];
          errors: unknown[];
        };
        const [boardLayer, cardLayer] = board.created;
        const boardId = boardLayer?.id ?? "";
        const cardId = cardLayer?.id ?? "";

        made.push(boardId);

        log.card = board;
        expect(board.errors).toEqual([]);
        log.cardXml = (await call("design_read", { node: boardId })).text;
        await call("screenshot", {
          node: cardId,
          save: join(OUT, "card.png"),
        });

        const widened = (await call("design_apply", { xml: `<Frame id="${cardId}" width="560px"/>` })).structured;
        const cardLine = (await call("design_read", { node: boardId })).text
          .split("\n")
          .find((line) => line.includes(`id="${cardId}"`));

        log.widened = {
          widened,
          cardLine,
        };
        expect(cardLine).toContain('width="560px"');
        expect(cardLine).not.toContain("height=");

        // An instance's text by its I…;… id: the characters change and its style stays (an auto-width label's box
        // follows them); the old text back reads exactly as before.
        const label = /<Text id="(I[^"]+)"[^>]*>([^<]+)<\/Text>/.exec(row);
        const [, labelId = "", labelText = ""] = label ?? [];
        const before = (await call("design_read", { node: labelId })).text;
        const unsized = (xml: string) => xml.replace(/ (width|height)="[^"]*"/g, "");

        texts.push([labelId, labelText]);

        const edited = (await call("design_apply", { xml: `<Text id="${labelId}">${labelText} now</Text>` }))
          .structured as { changed: string[]; errors: unknown[] };
        const after = (await call("design_read", { node: labelId })).text;

        log.instanceText = {
          id: labelId,
          edited,
          before,
          after,
        };
        expect(edited.changed).toEqual([labelId]);
        expect(unsized(after)).toBe(unsized(before).replace(`>${labelText}<`, `>${labelText} now<`));
        await call("design_apply", { xml: `<Text id="${labelId}">${labelText}</Text>` });
        texts.pop();
        expect((await call("design_read", { node: labelId })).text).toBe(before);

        // Stage 4b, all inside the board. (a) An instance of the page's Heading by name and variant, then another variant.
        const used = (await call("components_read", { scope: "used" })).structured as {
          components: { name: string; variants?: { id: string; name: string }[] }[];
        };
        const headingVariants = (used.components.find(({ name }) => name === "Heading")?.variants ?? []).map(
          ({ name }) => name,
        );
        const [firstVariant = "", secondVariant = firstVariant] = headingVariants;
        const instance = (
          await call("design_apply", {
            xml: `<Frame id="${boardId}"><Instance component="Heading" variant="${firstVariant}" position="absolute" left="40px" top="300px"/></Frame>`,
          })
        ).structured as { created: { id: string }[]; errors: unknown[] };
        const instanceId = instance.created[0]?.id ?? "";

        log.instance = {
          headingVariants,
          instance,
        };
        expect(instance.errors).toEqual([]);
        await call("design_apply", { xml: `<Instance id="${instanceId}" variant="${secondVariant}"/>` });
        expect((await call("design_read", { node: instanceId })).text).toContain(`variant="${secondVariant}"`);

        // (b) A set of two new variants with a text property, and an instance of it.
        const tag = (variant: string, fill: string, ink: string) =>
          `<Component variant="Tone=${variant}" display="flex" padding="8px 16px" background="${fill}" border-radius="7px"><Text prop="Label" color="${ink}" font="500 16px/normal 'Space Grotesk'">${variant}</Text></Component>`;
        const set = (
          await call("design_apply", {
            xml: `<Frame id="${boardId}"><ComponentSet name="Pixelwright check tag" position="absolute" left="400px" top="300px">${tag("Dark", "var(--Dark)", "#FFF")}${tag("Light", "var(--Grey)", "#000")}</ComponentSet><Instance component="Pixelwright check tag" variant="Tone=Light" props="Label=Made from XML" position="absolute" left="400px" top="420px"/></Frame>`,
          })
        ).structured as { created: { id: string; tag: string }[]; errors: unknown[] };
        const tagInstance = set.created.find(({ tag: kind }) => kind === "Instance")?.id ?? "";

        log.set = set;
        expect(set.errors).toEqual([]);

        // The instance looks like its variant: its props, and the variant's own background.
        const tagRead = (await call("design_read", { node: tagInstance })).text;

        expect(tagRead).toContain('props="Label=Made from XML"');
        expect(tagRead).toMatch(/^<Instance [^>]*background="var\(--Grey\)"/);

        // (b2) A set whose variant holds an instance: combined once its XML ends, both variants in it.
        const nested = (
          await call("design_apply", {
            xml: `<Frame id="${boardId}"><ComponentSet name="Pixelwright check nested" position="absolute" left="620px" top="300px"><Component variant="Kind=A" display="flex"><Instance component="Heading" variant="${firstVariant}"/></Component><Component variant="Kind=B" display="flex"><Text>B</Text></Component></ComponentSet></Frame>`,
          })
        ).structured as { created: { id: string; tag: string }[]; errors: unknown[] };
        const nestedRead = (
          await call("design_read", {
            node: nested.created.find(({ tag: kind }) => kind === "ComponentSet")?.id ?? "",
          })
        ).text;

        log.nested = {
          nested,
          nestedRead,
        };
        expect(nested.errors).toEqual([]);
        expect(nestedRead).toContain("Kind=A");
        expect(nestedRead).toContain("Kind=B");

        // (c) The row read with its files and sent back writes nothing; its image and icon made again from those files.
        const assets = join(OUT, "assets");
        const withFiles = (
          await call("design_read", {
            node: "2:4869",
            assetsDir: assets,
          })
        ).text;
        const filesBack = (await call("design_apply", { xml: withFiles })).structured;

        log.filesBack = filesBack;
        expect(filesBack).toEqual({
          created: [],
          changed: [],
          errors: [],
          dryRun: false,
        });

        const images = [...withFiles.matchAll(/<Image [^>]*src="([^"]+)"/g)].map(([, src]) => src ?? "");
        const icons = [...withFiles.matchAll(/<Icon [^>]*src="([^"]+\.svg)"/g)].map(([, src]) => src ?? "");
        const files = (
          await call("design_apply", {
            xml: `<Frame id="${boardId}"><Image src="${images[0]}" width="210px" height="166px" position="absolute" left="40px" top="420px"/><Icon src="${icons[0]}" width="41px" position="absolute" left="300px" top="420px"/></Frame>`,
          })
        ).structured as { created: { id: string; tag: string }[]; errors: unknown[] };
        const imageId = files.created.find(({ tag: kind }) => kind === "Image")?.id ?? "";

        log.files = {
          images,
          icons,
          files,
        };
        expect(files.errors).toEqual([]);

        // Figma's image hash is the SHA-1 of the file's bytes: the same file again changes nothing.
        const sameFile = (await call("design_apply", { xml: `<Image id="${imageId}" src="${images[0]}"/>` }))
          .structured;

        log.sameFile = sameFile;
        expect(sameFile).toMatchObject({
          changed: [],
          errors: [],
        });

        // (c2) An image wider than Figma takes (4096 px) is refused, and no empty rectangle is left.
        const wide = join(OUT, "wide.png");

        writeFileSync(wide, blankPng(4_100, 2));

        const tooWide = (
          await call("design_apply", {
            xml: `<Frame id="${boardId}"><Image src="${wide}" width="410px" height="10px"/></Frame>`,
          })
        ).structured as { created: unknown[]; errors: unknown[] };

        log.tooWide = tooWide;
        expect(tooWide.created).toEqual([]);
        expect(tooWide.errors).toHaveLength(1);

        if (images[1] !== undefined && images[1] !== images[0]) {
          const swapped = (await call("design_apply", { xml: `<Image id="${imageId}" src="${images[1]}"/>` }))
            .structured;

          log.swapped = swapped;
          expect(swapped).toMatchObject({ changed: [imageId] });
        }

        // (d) A copy of a card with a new title; the source card stays as it was.
        const sourceCard = (await call("design_read", { node: "2:4870" })).text;
        const copy = (
          await call("design_apply", {
            xml: `<Frame id="${boardId}"><Frame copyOf="2:4870" name="Pixelwright card copy" position="absolute" left="40px" top="700px"><Frame id="2:4871"><Instance id="2:4872"><Frame id="I2:4872;330:291"><Text id="I2:4872;330:292">Copied title</Text></Frame></Instance></Frame></Frame></Frame>`,
          })
        ).structured as { created: { id: string }[]; errors: unknown[] };
        const copyId = copy.created[0]?.id ?? "";

        log.copy = copy;
        expect(copy.errors).toEqual([]);
        expect((await call("design_read", { node: copyId })).text).toContain(">Copied title<");
        expect((await call("design_read", { node: "2:4870" })).text).toBe(sourceCard);

        // (d2) A new Heading instance named by the card's instance's ids: its own label changes, the card's stays.
        const cardHeading = (await call("design_read", { node: "2:4872" })).text;
        const headingVariant = /variant="([^"]+)"/.exec(cardHeading)?.[1] ?? "";
        const named = (
          await call("design_apply", {
            xml: `<Frame id="${boardId}"><Instance component="Heading" variant="${headingVariant}" position="absolute" left="500px" top="700px"><Frame id="I2:4872;330:291"><Text id="I2:4872;330:292">Named by another instance</Text></Frame></Instance></Frame>`,
          })
        ).structured as { created: { id: string }[]; errors: unknown[] };

        log.named = named;
        expect(named.errors).toEqual([]);
        expect((await call("design_read", { node: named.created[0]?.id ?? "" })).text).toContain(
          ">Named by another instance<",
        );
        expect((await call("design_read", { node: "2:4872" })).text).toBe(cardHeading);

        // (e) A note with a category the file lacks.
        await call("design_apply", { xml: `<Frame id="${cardId}" note="Pixelwright check: written live"/>` });
        expect((await call("design_read", { node: boardId })).text).toContain('note="Pixelwright check: written live"');

        // (f) The Heading instance moved into the card, then first in it: the text before it moves forward, after it
        // (how Figma counts insertChild's index for a layer already in that parent).
        const cardRead = (await call("design_read", { node: cardId })).text;
        const firstText = /<Text id="([^"]+)"/.exec(cardRead)?.[1] ?? "";

        await call("design_apply", {
          xml: `<Frame id="${cardId}"><Text id="${firstText}"/><Instance id="${instanceId}"/></Frame>`,
        });
        await call("design_apply", {
          xml: `<Frame id="${cardId}"><Instance id="${instanceId}"/><Text id="${firstText}"/></Frame>`,
        });

        const movedRead = (await call("design_read", { node: cardId })).text;

        log.moved = movedRead;
        expect(movedRead.indexOf(`id="${instanceId}"`)).toBeGreaterThan(-1);
        expect(movedRead.indexOf(`id="${instanceId}"`)).toBeLessThan(movedRead.indexOf(`id="${firstText}"`));

        log.deleted = (await call("nodes_delete", { nodes: made.splice(0) })).structured;
        // Taken back whole: the row reads as before.
        expect((await call("design_read", { node: "2:4869" })).text).toBe(row);

        // (g) execute: the code's value and logs; a thrown error with the logs before it.
        const ran = (
          await call("execute", { code: 'console.log("page", figma.currentPage.name); return figma.currentPage.name;' })
        ).structured as { result: unknown; logs: string[]; error?: string };
        const threw = (await call("execute", { code: 'console.log("before"); throw new Error("boom");' }))
          .structured as { logs: string[]; error?: string };

        log.execute = {
          ran,
          threw,
        };
        expect(ran.error).toBeUndefined();
        expect(typeof ran.result).toBe("string");
        expect(ran.logs[0]).toMatch(/^page /);
        expect(threw).toMatchObject({
          logs: ["before"],
          error: "Error: boom",
        });

        // (h) tokens_apply: a collection with two modes, three variables (one an alias) and three styles, read back;
        // the read sent back and the same input again change nothing; one change is reported. Taken back in finally.
        type Applied = {
          created: { kind: string; name: string }[];
          updated: { kind: string; name: string }[];
          errors: { kind: string; name: string; mode?: string; message: string }[];
        };

        tokensMade = true;

        const first = (await call("tokens_apply", TOKENS)).structured as Applied;
        // A Figma plan allowing one mode refuses Dark: its values wait, the rest goes in.
        const darkRefused = first.errors.some(({ kind, name }) => kind === "mode" && name === "Dark");

        log.tokensFirst = first;
        expect(first.errors.filter(({ kind, mode }) => kind !== "mode" && !(darkRefused && mode === "Dark"))).toEqual(
          [],
        );
        expect(first.created.map(({ kind, name }) => `${kind} ${name}`)).toEqual(
          expect.arrayContaining([
            "collection Pixelwright check",
            "variable pixelwright/accent",
            "variable pixelwright/gap",
            "variable pixelwright/link",
            "paint Pixelwright check/paint",
            "text Pixelwright check/text",
            "effect Pixelwright check/effect",
          ]),
        );

        const readBack = (
          await call("tokens_read", {
            format: "json",
            collections: ["Pixelwright check"],
          })
        ).structured as { tokens: Record<string, unknown> };
        const roundTrip = (await call("tokens_apply", { ...readBack.tokens })).structured as Applied;
        const again = (await call("tokens_apply", TOKENS)).structured as Applied;
        const changed = (
          await call("tokens_apply", {
            collections: [
              {
                name: "Pixelwright check",
                variables: [
                  {
                    name: "pixelwright/gap",
                    values: { Light: "16px" },
                  },
                ],
              },
            ],
          })
        ).structured as Applied;

        log.tokens = {
          readBack,
          roundTrip,
          again,
          changed,
        };
        expect(roundTrip).toMatchObject({
          created: [],
          updated: [],
          errors: [],
        });
        expect(again).toMatchObject({
          created: [],
          updated: [],
        });
        expect(changed.updated).toEqual([
          {
            kind: "variable",
            collection: "Pixelwright check",
            name: "pixelwright/gap",
          },
        ]);
      } finally {
        if (tokensMade) {
          log.tokensCleanup = await call("execute", { code: CLEAN_TOKENS }).catch((error: unknown) => String(error));
        }

        for (const [id, characters] of texts) {
          await call("design_apply", { xml: `<Text id="${id}">${characters}</Text>` }).catch(() => undefined);
        }

        if (made.length > 0) {
          log.cleanup = await call("nodes_delete", { nodes: made }).catch((error: unknown) => String(error));
        }

        writeFileSync(join(OUT, "live-write.json"), JSON.stringify(log, null, 2));
        await client.close();
      }
    },
    120_000 + WAIT,
  );
});
