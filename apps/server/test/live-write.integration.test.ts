import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const entry = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
const OUT = process.env.PIXELWRIGHT_LIVE ?? "";
const WRITE = process.env.PIXELWRIGHT_LIVE_WRITE === "1";
/** Seconds to wait for the user to switch Allow edits on before the writes (PIXELWRIGHT_LIVE_WAIT, default none). */
const WAIT = Number(process.env.PIXELWRIGHT_LIVE_WAIT ?? "0") * 1_000;

/** The Positivus test file: Maxim's test file, anything may be done in it. Writes go nowhere else. */
const FILE = "Untitled";

/** A Positivus-like card made from XML with the file's library styles and fonts. */
const CARD = `<Frame name="Pixelwright check card" display="flex" flex-direction="column" gap="16px" padding="40px" border-radius="45px" background="var(--Grey)" border="1px solid var(--Dark)" box-shadow="0 5px 0 0 #191A23">
  <Text textStyle="h3" color="var(--Black)">Written by Pixelwright</Text>
  <Text width="320px" textStyle="p" color="var(--Dark)">A card made from XML, with the file's own styles.</Text>
</Frame>`;

/** S1: is a layer's opacity, and its inner shadow, in what Figma exports? A faded red square with a black inner rim. */
const PROBE =
  '<Rectangle name="Pixelwright S1 probe" width="40px" height="40px" background="#F00" opacity="0.5" box-shadow="inset 0 0 0 4px #000"/>';

type Call = (name: string, args: Record<string, unknown>) => Promise<{ structured: unknown; text: string }>;

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
          components: { name: string; variants?: string[] }[];
        };
        const headingVariants = used.components.find(({ name }) => name === "Heading")?.variants ?? [];
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
        expect((await call("design_read", { node: tagInstance })).text).toContain('props="Label=Made from XML"');

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

        // (e) A note with a category the file lacks.
        await call("design_apply", { xml: `<Frame id="${cardId}" note="Pixelwright check: written live"/>` });
        expect((await call("design_read", { node: boardId })).text).toContain('note="Pixelwright check: written live"');

        // (f) The Heading instance moved into the card, then first in it.
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
      } finally {
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

/** One pixel of an 8-bit RGB or RGBA PNG: inflate the image data and undo each row's filter down to the row asked. */
function pixel(png: Buffer, x: number, y: number): number[] {
  const width = png.readUInt32BE(16);
  const channels = png[25] === 6 ? 4 : 3;
  const parts: Buffer[] = [];

  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);

    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      parts.push(png.subarray(offset + 8, offset + 8 + length));
    }

    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  let previous = Buffer.alloc(stride);

  for (let row = 0; row <= y; row++) {
    const start = row * (stride + 1);
    const filter = raw[start] ?? 0;
    const line = Buffer.from(raw.subarray(start + 1, start + 1 + stride));

    for (let index = 0; index < stride; index++) {
      const left = index >= channels ? (line[index - channels] ?? 0) : 0;
      const up = previous[index] ?? 0;
      const corner = index >= channels ? (previous[index - channels] ?? 0) : 0;
      const guess = left + up - corner;
      const paeth =
        Math.abs(guess - left) <= Math.abs(guess - up) && Math.abs(guess - left) <= Math.abs(guess - corner)
          ? left
          : Math.abs(guess - up) <= Math.abs(guess - corner)
            ? up
            : corner;
      const predicted = [0, left, up, (left + up) >> 1, paeth][filter] ?? 0;

      line[index] = ((line[index] ?? 0) + predicted) & 255;
    }

    previous = line;
  }

  return [...previous.subarray(x * channels, x * channels + channels)];
}
