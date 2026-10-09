import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ApplyChange, designXml, type Snapshot, SnapshotSchema } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { memoryFiles } from "../src/assets/written-files.ts";
import { applyDesign } from "../src/mcp/tools/apply.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A bridge over one snapshot: entries come from it (cut below the root when asked), apply answers what it was given. */
function bridgeOver(snapshot: Snapshot, { cut = false }: { cut?: boolean } = {}) {
  const requests: { op: string; input: Record<string, unknown> }[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: true,
      },
    ],
    request: async (op, input) => {
      requests.push({
        op,
        input: input as Record<string, unknown>,
      });

      if (op === "upload") {
        const { offset, chunk } = input as { offset: number; chunk: string };

        return { received: offset + Buffer.from(chunk, "base64").length };
      }

      if (op === "entries") {
        return {
          roots: [
            {
              node: cut
                ? {
                    ...snapshot.root,
                    children: [],
                  }
                : snapshot.root,
              parent: null,
            },
          ],
          missing: [],
          styles: snapshot.styles,
          variables: snapshot.variables,
        };
      }

      const { changes } = input as { changes: ApplyChange[] };

      return {
        created: changes
          .filter((change) => change.kind === "create")
          .map((change) => ({
            line: change.line,
            ref: change.ref,
            id: `90:${change.line}`,
            tag: change.tag,
          })),
        changed: changes.flatMap((change) => (change.id === null ? [] : [change.id])),
        errors: [],
      };
    },
  };

  return {
    bridge,
    requests,
    sent: () => (requests.find(({ op }) => op === "apply")?.input.changes ?? []) as ApplyChange[],
  };
}

/** The Services row captured from Positivus, core's fixture. */
const ROW = SnapshotSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../packages/core/test/fixtures/positivus-services-row.json", import.meta.url), "utf8"),
  ),
);

describe("design_apply", () => {
  it("writes nothing for the XML design_read returned, sent back as it was", async () => {
    const { bridge, requests } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: designXml(ROW).xml,
      dryRun: false,
    });

    expect(result).toEqual({
      created: [],
      changed: [],
      errors: [],
      dryRun: false,
    });
    expect(requests.map(({ op }) => op)).toEqual(["entries"]);
  });

  it("sends only what changed, in Figma's terms, with the layer's own layout around it", async () => {
    const xml = designXml(ROW).xml.replace('gap="40px"', 'gap="48px"');
    const { bridge, sent } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml,
      dryRun: false,
    });

    expect(result.errors).toEqual([]);
    expect(sent()).toEqual([
      expect.objectContaining({
        kind: "update",
        id: "2:4869",
        props: expect.objectContaining({ itemSpacing: 48 }),
      }),
    ]);
  });

  it("returns a parse error with its line and column and asks the plugin for nothing", async () => {
    const { bridge, requests } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: '<Frame id="2:4869">\n  <Text>Hi</Frame>',
      dryRun: false,
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringMatching(/Expected <\/Text>/),
      }),
    ]);
    expect(requests).toEqual([]);
  });

  it("keeps writing the rest when an element has a bad attribute, and passes a dry run on", async () => {
    const { bridge, sent, requests } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: '<Frame id="2:4869" gapp="8px" opacity="0.5"/>\n<Frame name="New" background="#FFF"/>',
      parent: "2:4766",
      dryRun: true,
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        line: 1,
        attribute: "gapp",
        hint: expect.stringMatching(/gap/),
      }),
    ]);
    expect(sent().map((change) => [change.kind, change.props])).toEqual([
      ["update", { opacity: 0.5 }],
      [
        "create",
        expect.objectContaining({
          name: "New",
        }),
      ],
    ]);
    expect(requests.find(({ op }) => op === "apply")?.input).toMatchObject({
      parent: "2:4766",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
  });

  it("marks moves, into a new layer, into another parent, next to another, in another order, with their siblings", async () => {
    const { bridge, sent } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: [
        '<Frame name="Row" display="flex"><Frame id="2:4870"/></Frame>',
        '<Frame id="2:4869"><Frame id="2:4877" opacity="0.5"/></Frame>',
        '<Frame id="2:4876" after="2:4870"/>',
      ].join("\n"),
      dryRun: false,
    });

    expect(result.errors).toEqual([]);
    expect(sent().map((change) => [change.id ?? change.tag, change.move ?? false])).toEqual([
      ["Frame", false],
      ["2:4870", true],
      ["2:4869", false],
      ["2:4877", true],
      ["2:4876", true],
    ]);
    // What the layer itself was asked for goes in with the move.
    expect(sent().find((change) => change.id === "2:4877")?.props).toEqual({ opacity: 0.5 });

    const reordered = bridgeOver(ROW);

    await applyDesign(reordered.bridge, {
      xml: '<Frame id="2:4869"><Frame id="2:4876"/><Frame id="2:4870"/></Frame>',
      dryRun: false,
    });

    // The layer before it in the XML goes along, so the plugin can place it after that one.
    expect(reordered.sent().map((change) => [change.id, change.move ?? false])).toEqual([
      ["2:4869", false],
      ["2:4876", false],
      ["2:4870", true],
    ]);
  });

  it("refuses a layer whose state the read could not take, instead of writing it whole", async () => {
    const { bridge, sent } = bridgeOver(ROW, { cut: true });
    const result = await applyDesign(bridge, {
      xml: '<Frame id="2:4869" opacity="0.9"><Frame id="2:4870" opacity="0.5"/></Frame>',
      dryRun: false,
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        id: "2:4870",
        message: expect.stringMatching(/could not read/),
      }),
    ]);
    expect(sent().map((change) => change.id)).toEqual(["2:4869"]);
  });
});

/** A frame holding a photo (a leaf with an image fill: design_read's Image) whose image is these bytes. */
function photoSnapshot(bytes: Buffer): Snapshot {
  return {
    root: {
      id: "1:1",
      name: "Gallery",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      childCount: 1,
      layoutMode: "HORIZONTAL",
      children: [
        {
          id: "1:2",
          name: "Photo",
          type: "RECTANGLE",
          visible: true,
          x: 0,
          y: 0,
          width: 300,
          height: 200,
          childCount: 0,
          fills: [
            {
              type: "IMAGE",
              imageHash: createHash("sha1").update(bytes).digest("hex"),
              scaleMode: "FILL",
            },
          ],
        },
      ],
    },
    styles: {},
    variables: {},
  };
}

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63f8cfc0f01f0005000201" +
    "e1d7f0a50000000049454e44ae426082",
  "hex",
);

describe("design_apply: files", () => {
  const folder = () => {
    const dir = mkdtempSync(join(tmpdir(), "pixelwright-apply-"));

    writeFileSync(join(dir, "photo.png"), PNG);
    writeFileSync(join(dir, "other.png"), Buffer.concat([PNG, Buffer.from("x")]));
    writeFileSync(join(dir, "arrow.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');

    return dir;
  };

  it("leaves an image as it is when its file holds the same bytes, and swaps it when they differ", async () => {
    const dir = folder();
    const snapshot = photoSnapshot(PNG);
    const xml = designXml(snapshot).xml;
    const same = bridgeOver(snapshot);
    const kept = await applyDesign(
      same.bridge,
      {
        xml: xml.replace(/src="[^"]+"/, 'src="photo.png"'),
        dryRun: false,
      },
      { cwd: dir },
    );

    expect(kept.errors).toEqual([]);
    expect(same.requests.map(({ op }) => op)).toEqual(["entries"]);

    const swapped = bridgeOver(snapshot);

    await applyDesign(
      swapped.bridge,
      {
        xml: xml.replace(/src="[^"]+"/, 'src="other.png"'),
        dryRun: false,
      },
      { cwd: dir },
    );

    expect(swapped.requests.map(({ op }) => op)).toEqual(["entries", "upload", "apply"]);
    expect(swapped.sent()[0]?.props.asset).toMatchObject({
      kind: "image",
      src: "other.png",
      stream: expect.any(String),
    });
  });

  it("keeps an image whose file design_read wrote for it (a render, not the original), wherever the file went", async () => {
    const dir = folder();
    const snapshot = photoSnapshot(PNG);
    const render = Buffer.concat([PNG, Buffer.from("render")]);
    const files = memoryFiles();

    mkdirSync(join(dir, "moved"));
    writeFileSync(join(dir, "moved", "hero.png"), render);
    await files.add([
      {
        sha1: createHash("sha1").update(render).digest("hex"),
        node: "1:2",
      },
    ]);

    const { bridge, requests } = bridgeOver(snapshot);
    const result = await applyDesign(
      bridge,
      {
        xml: designXml(snapshot).xml.replace(/src="[^"]+"/, 'src="moved/hero.png"'),
        dryRun: false,
      },
      {
        cwd: dir,
        files,
      },
    );

    expect(result.errors).toEqual([]);
    expect(requests.map(({ op }) => op)).toEqual(["entries"]);
  });

  it("swaps an image whose file design_read wrote once another picture is saved over it", async () => {
    const dir = folder();
    const snapshot = photoSnapshot(PNG);
    const files = memoryFiles();

    // design_read wrote the photo's render as photo-2.png; the user then saved a new picture under that name.
    await files.add([
      {
        sha1: createHash("sha1")
          .update(Buffer.concat([PNG, Buffer.from("render")]))
          .digest("hex"),
        node: "1:2",
      },
    ]);
    writeFileSync(join(dir, "photo-2.png"), Buffer.concat([PNG, Buffer.from("new picture")]));

    const { bridge, requests } = bridgeOver(snapshot);

    await applyDesign(
      bridge,
      {
        xml: designXml(snapshot).xml.replace(/src="[^"]+"/, 'src="photo-2.png"'),
        dryRun: false,
      },
      {
        cwd: dir,
        files,
      },
    );

    expect(requests.map(({ op }) => op)).toEqual(["entries", "upload", "apply"]);
  });

  it("refuses an existing image's file that is not there, unless it is the one design_read only planned", async () => {
    const dir = folder();
    const snapshot = photoSnapshot(PNG);
    const xml = designXml(snapshot).xml;
    const planned = bridgeOver(snapshot);
    const kept = await applyDesign(
      planned.bridge,
      {
        xml,
        dryRun: false,
      },
      { cwd: dir },
    );

    expect(kept.errors).toEqual([]);

    const { bridge } = bridgeOver(snapshot);
    const result = await applyDesign(
      bridge,
      {
        xml: xml.replace(/src="[^"]+"/, 'src="gone.png"'),
        dryRun: false,
      },
      { cwd: dir },
    );

    expect(result.errors).toEqual([
      expect.objectContaining({
        id: "1:2",
        attribute: "src",
        message: expect.stringMatching(/gone\.png/),
      }),
    ]);
  });

  it("refuses a WebP file for a new image: Figma makes images of PNG, JPG and GIF", async () => {
    const dir = folder();

    writeFileSync(
      join(dir, "photo.webp"),
      Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]),
    );

    const { bridge } = bridgeOver(photoSnapshot(PNG));
    const result = await applyDesign(
      bridge,
      {
        xml: '<Image src="photo.webp"/>',
        parent: "1:1",
        dryRun: false,
      },
      { cwd: dir },
    );

    expect(result.errors).toEqual([
      expect.objectContaining({
        attribute: "src",
        message: expect.stringMatching(/WebP/),
      }),
    ]);
  });

  it("uploads a file in chunks once for every element naming it, and sends an icon's SVG inline", async () => {
    const dir = folder();
    const { bridge, requests, sent } = bridgeOver(photoSnapshot(PNG));
    const result = await applyDesign(
      bridge,
      {
        xml: '<Image src="photo.png" width="10px"/>\n<Image src="photo.png" width="20px"/>\n<Icon src="arrow.svg"/>',
        parent: "1:1",
        dryRun: false,
      },
      {
        cwd: dir,
        chunkBytes: 32,
      },
    );
    const uploads = requests.filter(({ op }) => op === "upload");

    expect(result.errors).toEqual([]);
    expect(uploads.map(({ input }) => input.offset)).toEqual([0, 32, 64]);
    expect(new Set(sent().map((change) => change.props.asset?.stream ?? "svg")).size).toBe(2);
    expect(sent()[2]?.props.asset?.svg).toContain("<svg");
  });

  it("refuses a missing or wrong file on the element that names it, and writes the rest", async () => {
    const dir = folder();
    const { bridge, sent } = bridgeOver(photoSnapshot(PNG));
    const result = await applyDesign(
      bridge,
      {
        xml: '<Image src="nowhere.png"/>\n<Icon src="photo.png"/>\n<Frame name="Kept"/>',
        parent: "1:1",
        dryRun: false,
      },
      { cwd: dir },
    );

    expect(result.errors.map(({ line, attribute }) => [line, attribute])).toEqual([
      [1, "src"],
      [2, "src"],
    ]);
    expect(sent().map((change) => change.tag)).toEqual(["Frame"]);
  });
});

describe("design_apply on a big read", () => {
  it("sends back 5 000 layers read with design_read in a few seconds, writing nothing", async () => {
    const rectangle = (id: string, y: number) => ({
      id,
      name: `Bar ${id}`,
      type: "RECTANGLE",
      visible: true,
      x: 0,
      y,
      width: 100,
      height: 8,
      childCount: 0,
      fills: [
        {
          type: "SOLID",
          visible: true,
          opacity: 1,
          blendMode: "NORMAL",
          color: {
            r: 0.1,
            g: 0.2,
            b: 0.3,
          },
        },
      ],
    });
    const column = (index: number) => ({
      id: `2:${index}`,
      name: `Column ${index}`,
      type: "FRAME",
      visible: true,
      x: index * 120,
      y: 0,
      width: 100,
      height: 1_000,
      childCount: 100,
      layoutMode: "VERTICAL",
      itemSpacing: 2,
      children: Array.from({ length: 100 }, (_, row) => rectangle(`3:${index * 100 + row}`, row * 10)),
    });
    const snapshot = SnapshotSchema.parse({
      root: {
        id: "1:1",
        name: "Chart",
        type: "FRAME",
        visible: true,
        x: 0,
        y: 0,
        width: 6_000,
        height: 1_000,
        childCount: 50,
        children: Array.from({ length: 50 }, (_, index) => column(index)),
      },
      styles: {},
      variables: {},
    });
    const { xml } = designXml(snapshot);
    const { bridge, requests } = bridgeOver(snapshot);
    const started = performance.now();
    const result = await applyDesign(bridge, {
      xml,
      dryRun: false,
    });

    expect(result.errors).toEqual([]);
    expect(requests.map(({ op }) => op)).toEqual(["entries"]);
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});
