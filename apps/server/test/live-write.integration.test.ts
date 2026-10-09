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
