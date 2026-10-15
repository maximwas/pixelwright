import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ApplyChange,
  assessElements,
  CurrentLayers,
  changeOf,
  designXml,
  readApply,
  type Snapshot,
} from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { memoryFiles, type WrittenFiles } from "../src/assets/written-files.ts";
import { FileAttacher } from "../src/features/design-apply/attach-files.ts";
import { fileChangesOf, KnownRenders } from "../src/features/design-apply/file-changes.ts";
import { SourceFiles } from "../src/features/design-apply/source-files.ts";
import { uploadFile } from "../src/features/design-apply/upload.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { PNG, pngHeader } from "./helpers/images.ts";
import { recordingBridge } from "./helpers/recording-bridge.ts";

const sha1 = (bytes: Buffer) => createHash("sha1").update(bytes).digest("hex");

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>';
const OTHER = Buffer.concat([PNG, Buffer.from("x")]);
/** A WebP's RIFF header with a VP8X chunk of a 1×1 picture: enough for a reader of sizes. */
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBPVP8X"),
  Buffer.from([10, 0, 0, 0]),
  Buffer.alloc(10),
]);

/** A frame 1:1 holding a photo 1:2 whose image is PNG's bytes: design_read's Image. */
const PHOTO: Snapshot = {
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
            imageHash: sha1(PNG),
            scaleMode: "FILL",
          },
        ],
      },
    ],
  },
  styles: {},
  variables: {},
};

/** The path design_read plans for the photo, which it does not write without an assetsDir. */
const PLANNED = /src="([^"]+)"/.exec(designXml(PHOTO).xml)?.[1] ?? "";

function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), "pixelwright-apply-files-"));

  writeFileSync(join(dir, "photo.png"), PNG);
  writeFileSync(join(dir, "other.png"), OTHER);
  writeFileSync(join(dir, "arrow.svg"), SVG);
  writeFileSync(join(dir, "big.svg"), `<svg>${" ".repeat(2 * 1024 * 1024)}</svg>`);
  writeFileSync(join(dir, "notes.txt"), "not an image");
  writeFileSync(join(dir, "photo.webp"), WEBP);
  writeFileSync(join(dir, "wide.png"), pngHeader(4_100, 2));
  mkdirSync(join(dir, "folder.png"));

  return dir;
}

const DIR = folder();

/** A store of written files that counts its reads. */
function countedFiles(written: readonly { sha1: string; node: string }[] = []) {
  const files = memoryFiles();
  const store = {
    reads: 0,
    read: () => {
      store.reads += 1;

      return files.read();
    },
    add: files.add,
  } satisfies WrittenFiles & { reads: number };

  return {
    store,
    ready: files.add(written),
  };
}

describe("SourceFiles", () => {
  it("reads a file by its path from the folder, with its SHA-1", async () => {
    await expect(new SourceFiles(DIR).read("photo.png", "image")).resolves.toEqual({
      file: {
        path: join(DIR, "photo.png"),
        bytes: PNG,
        sha1: sha1(PNG),
      },
    });
  });

  it("reads each file once per kind in a call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pixelwright-apply-once-"));
    const sources = new SourceFiles(dir);

    writeFileSync(join(dir, "photo.png"), PNG);
    await sources.read("photo.png", "image");
    writeFileSync(join(dir, "photo.png"), OTHER);

    await expect(sources.read("photo.png", "image")).resolves.toMatchObject({ file: { sha1: sha1(PNG) } });
    await expect(new SourceFiles(dir).read("photo.png", "image")).resolves.toMatchObject({
      file: { sha1: sha1(OTHER) },
    });
  });

  it("says why a file cannot be used", async () => {
    const sources = new SourceFiles(DIR);
    const missing = (path: string) => ({
      problem: "missing",
      message: `${path} is not a file the server can read (paths are from its folder: ${DIR}).`,
    });

    expect(
      await Promise.all([
        sources.read("nowhere.png", "image"),
        sources.read("folder.png", "image"),
        sources.read("notes.txt", "image"),
        sources.read("photo.png", "icon"),
        sources.read("big.svg", "icon"),
      ]),
    ).toEqual([
      missing("nowhere.png"),
      missing("folder.png"),
      {
        problem: "unusable",
        message: "notes.txt is not a PNG, JPG, GIF or WebP image.",
      },
      {
        problem: "unusable",
        message: "photo.png is not an SVG: an <Icon> is drawn from an SVG file.",
      },
      {
        problem: "unusable",
        message: "big.svg is 2 MB: design_apply takes an SVG of 2 MB at most.",
      },
    ]);
  });
});

describe("fileChangesOf", () => {
  /** What the files of each element change, by ref, against the photo as the plugin read it. */
  async function filesOf(xml: string, renders = new KnownRenders(memoryFiles())) {
    const { elements } = readApply(xml);
    const layers = CurrentLayers.of({
      roots: [
        {
          node: PHOTO.root,
          parent: null,
        },
      ],
      missing: [],
      styles: {},
      variables: {},
    });

    return Object.fromEntries(
      await fileChangesOf(assessElements(elements, layers).assessed, new SourceFiles(DIR), renders),
    );
  }

  const nothing = {
    changed: [],
    problems: [],
  };

  it("keeps an Image's src holding the layer's own bytes, and writes one holding others again", async () => {
    expect(await filesOf('<Image id="1:2" src="photo.png"/>\n<Frame id="1:1" background="url(other.png)"/>')).toEqual({
      "1:2": nothing,
      "1:1": {
        changed: ["background"],
        problems: [],
      },
    });
    expect((await filesOf('<Image id="1:2" src="other.png"/>'))["1:2"]).toEqual({
      changed: ["src"],
      problems: [],
    });
  });

  it("keeps a file design_read or assets_export wrote for that layer, and only that layer", async () => {
    const { store, ready } = countedFiles([
      {
        sha1: sha1(OTHER),
        node: "1:2",
      },
    ]);

    await ready;
    expect(await filesOf('<Image id="1:2" src="other.png"/>', new KnownRenders(store))).toEqual({ "1:2": nothing });
    expect(await filesOf('<Frame id="1:1" background="url(other.png)"/>', new KnownRenders(store))).toEqual({
      "1:1": {
        changed: ["background"],
        problems: [],
      },
    });
  });

  it("reads the store of written files once, and only when a file's bytes are not the layer's", async () => {
    const { store, ready } = countedFiles();

    await ready;
    await filesOf('<Image id="1:2" src="photo.png"/>', new KnownRenders(store));
    expect(store.reads).toBe(0);
    await filesOf(
      '<Image id="1:2" src="other.png"/>\n<Frame id="1:1" background="url(other.png)"/>',
      new KnownRenders(store),
    );
    expect(store.reads).toBe(1);
  });

  it("lets the path design_read planned be missing, and reports any other file that cannot be used", async () => {
    expect(await filesOf(`<Image id="1:2" src="${PLANNED}"/>`)).toEqual({ "1:2": nothing });
    expect(await filesOf(`<Image id="1:2" src="${PLANNED.replace(/\.png$/, "-12.png")}"/>`)).toEqual({
      "1:2": nothing,
    });
    expect(await filesOf('<Image id="1:2" src="nowhere.png"/>\n<Frame id="1:1" background="url(notes.txt)"/>')).toEqual(
      {
        "1:2": {
          changed: [],
          problems: [
            {
              attribute: "src",
              message: `nowhere.png is not a file the server can read (paths are from its folder: ${DIR}).`,
            },
          ],
        },
        "1:1": {
          changed: [],
          problems: [
            {
              attribute: "background",
              message: "notes.txt is not a PNG, JPG, GIF or WebP image.",
            },
          ],
        },
      },
    );
  });

  it("writes a background again at its first url() with other bytes, and checks no further", async () => {
    expect(await filesOf('<Frame id="1:1" background="url(nowhere.png), url(other.png)"/>')).toEqual({
      "1:1": {
        changed: ["background"],
        problems: [
          {
            attribute: "background",
            message: `nowhere.png is not a file the server can read (paths are from its folder: ${DIR}).`,
          },
        ],
      },
    });
    expect(await filesOf('<Frame id="1:1" background="url(other.png), url(nowhere.png)"/>')).toEqual({
      "1:1": {
        changed: ["background"],
        problems: [],
      },
    });
  });

  it("refuses another drawing for an Icon, keeps its planned file or a render of it, and skips a create", async () => {
    const { store, ready } = countedFiles([
      {
        sha1: sha1(Buffer.from(SVG)),
        node: "1:2",
      },
    ]);

    await ready;
    expect(await filesOf('<Icon id="1:2" src="other.svg"/>\n<Image src="other.png"/>')).toEqual({
      "1:2": {
        changed: [],
        problems: [
          {
            attribute: "src",
            message: `other.svg is not a file the server can read (paths are from its folder: ${DIR}).`,
          },
        ],
      },
    });
    expect(await filesOf('<Icon id="1:2" src="arrow.svg"/>')).toEqual({
      "1:2": {
        changed: [],
        problems: [
          {
            attribute: "src",
            message:
              "arrow.svg would redraw the icon: an icon's SVG makes new vector layers, so delete the icon and create it again from the file.",
          },
        ],
      },
    });
    expect(await filesOf('<Icon id="1:2" src="arrow.svg"/>', new KnownRenders(store))).toEqual({ "1:2": nothing });
    expect(await filesOf(`<Icon id="1:2" src="${PLANNED}"/>`)).toEqual({ "1:2": nothing });
  });
});

describe("FileAttacher", () => {
  /** The changes of this XML, written from nothing, with their files attached through a recording plugin. */
  async function attached(xml: string, dryRun = false) {
    const recorded = recordingBridge(PHOTO);
    const changes = readApply(xml).elements.map((element) => changeOf(element).change);
    const attacher = new FileAttacher(new PluginClient(recorded.bridge).session(), new SourceFiles(DIR), {
      dryRun,
      chunkBytes: 1_024,
    });

    return {
      ...(await attacher.attach(changes)),
      uploads: recorded.requests.filter(({ op }) => op === "upload").map(({ input }) => input.stream),
    };
  }

  const streamsOf = (changes: readonly ApplyChange[]) =>
    changes.map(({ props }) => props.asset?.stream ?? props.fills?.find((paint) => paint.kind === "image")?.stream);

  it("uploads each image once and names its stream wherever it is used", async () => {
    const { changes, errors, uploads } = await attached(
      '<Image src="photo.png" width="10px"/>\n<Image src="photo.png" width="20px"/>\n<Frame id="1:1" background="url(photo.png)"/>',
    );

    expect(errors).toEqual([]);
    expect(uploads).toHaveLength(1);
    expect(streamsOf(changes)).toEqual([uploads[0], uploads[0], uploads[0]]);
  });

  it("carries an Icon's SVG inline and never uploads it", async () => {
    const { changes, uploads } = await attached('<Icon src="arrow.svg"/>');

    expect(changes[0]?.props.asset).toMatchObject({ svg: SVG });
    expect(changes[0]?.props.asset?.stream).toBeUndefined();
    expect(uploads).toEqual([]);
  });

  it("uploads nothing on a dry run", async () => {
    const { changes, errors, uploads } = await attached('<Image src="photo.png" width="10px"/>', true);

    expect(errors).toEqual([]);
    expect(uploads).toEqual([]);
    expect(streamsOf(changes)).toEqual([undefined]);
  });

  it("drops an Image made from nothing without its file, and keeps an update or a copy without the asset", async () => {
    const { changes, errors } = await attached(
      '<Image src="nowhere.png"/>\n<Image id="1:2" src="nowhere.png"/>\n<Image copyOf="1:2" src="nowhere.png"/>',
    );

    expect(changes.map(({ line, props }) => [line, props.asset])).toEqual([
      [2, undefined],
      [3, undefined],
    ]);
    expect(errors.map(({ line, attribute }) => [line, attribute])).toEqual([
      [1, "src"],
      [2, "src"],
      [3, "src"],
    ]);
  });

  it("drops the fills when a file of theirs cannot be used", async () => {
    const { changes, errors } = await attached('<Frame id="1:1" opacity="0.5" background="url(notes.txt)"/>');

    expect(changes[0]?.props).toEqual({ opacity: 0.5 });
    expect(errors).toEqual([
      {
        line: 1,
        column: 1,
        id: "1:1",
        attribute: "background",
        message: "notes.txt is not a PNG, JPG, GIF or WebP image.",
      },
    ]);
  });

  it("refuses a WebP image and one wider than Figma takes, before uploading", async () => {
    const { errors, uploads } = await attached('<Image src="photo.webp"/>\n<Image src="wide.png"/>');

    expect(errors.map(({ message }) => message)).toEqual([
      "photo.webp is a WebP image: Figma makes images of PNG, JPG and GIF files only, so convert it first.",
      "wide.png is 4100×2 px: Figma takes images up to 4096 px a side, so scale it down first.",
    ]);
    expect(uploads).toEqual([]);
  });
});

describe("uploadFile", () => {
  it("sends the bytes in chunks one after another, at their offsets, under the stream it returns", async () => {
    const recorded = recordingBridge(PHOTO);
    const stream = await uploadFile(new PluginClient(recorded.bridge).session(), Buffer.from("abcdefghij"), 4);

    expect(recorded.requests.map(({ input }) => input)).toEqual(
      ["abcd", "efgh", "ij"].map((chunk, index) => ({
        stream,
        offset: index * 4,
        chunk: Buffer.from(chunk).toString("base64"),
        total: 10,
      })),
    );
  });
});
