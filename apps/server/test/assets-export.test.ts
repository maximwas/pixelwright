import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BridgeError } from "@pixelwright/core";
import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { memoryFiles } from "../src/assets/written-files.ts";
import { exportAssets } from "../src/features/assets-export/export-assets.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";
import { JPEG, PNG } from "./helpers/images.ts";

const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/orbit-customers.json", import.meta.url), "utf8"),
) as unknown;

const HASH = "c".repeat(40);

/** A layer as the snapshot op returns it, alone. */
const layer = (id: string, name: string, extra: object = {}) => ({
  root: {
    id,
    name,
    type: "RECTANGLE",
    visible: true,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    childCount: 0,
    ...extra,
  },
  styles: {},
  variables: {},
});

/** 30 photos; 1:1 and 1:2 render to the same bytes, 1:3 and 1:4 share a name; 0:1 is a page, 9:9 does not exist. */
function file() {
  const exported: { node: string; format: string; effects: boolean; scale: number }[] = [];
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
      const { node, offset = 0 } = input as { node: string; offset?: number };

      if (op === "snapshot") {
        if (node === "54:434") {
          return ROW;
        }

        if (node === "0:1") {
          throw new BridgeError("NODE_NOT_FOUND", "0:1 is a page: read a layer on a page.");
        }

        if (node === "9:9") {
          throw new BridgeError("NODE_NOT_FOUND", "No node 9:9 in this file.");
        }

        const name = node === "1:3" || node === "1:4" ? "Hero photo" : `Photo ${node}`;

        return layer(node, name, {
          fills: [
            {
              type: "IMAGE",
              imageHash: HASH,
              scaleMode: "FILL",
            },
          ],
        });
      }

      const bytes =
        op === "image"
          ? JPEG
          : node === "1:1" || node === "1:2"
            ? Buffer.concat([PNG, Buffer.from("same")])
            : Buffer.concat([PNG, Buffer.from(node)]);

      if (op === "export" && offset === 0) {
        exported.push(input as (typeof exported)[number]);
      }

      return {
        scale: 2,
        totalBytes: bytes.length,
        bytes: bytes.subarray(offset).toString("base64"),
      };
    },
  };

  return {
    bridge,
    exported,
  };
}

describe("assets_export", () => {
  it("writes each named layer once, the same bytes in one file, a clash suffixed, and reports the bad ids apart", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const nodes = [...Array.from({ length: 28 }, (_, index) => `1:${index + 1}`), "0:1", "9:9"];
    const result = await exportAssets(new PluginClient(file().bridge), {
      nodes,
      dir,
      original: false,
    });

    expect(result.errors).toEqual([
      {
        node: "0:1",
        message: "NODE_NOT_FOUND: 0:1 is a page: read a layer on a page.",
      },
      {
        node: "9:9",
        message: "NODE_NOT_FOUND: No node 9:9 in this file.",
      },
    ]);
    expect(result.files).toHaveLength(28);
    expect(result.files[0]?.path).toBe(result.files[1]?.path);
    expect(result.files.slice(2, 4).map((written) => written.path)).toEqual([
      join(dir, "hero-photo.png"),
      join(dir, "hero-photo-2.png"),
    ]);
    expect(await readdir(dir)).toHaveLength(27);
  });

  it("says which path design_read planned whenever a layer's file got another name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(new PluginClient(file().bridge), {
      nodes: ["1:1", "1:2", "1:3", "1:4"],
      dir,
      original: false,
    });
    const [first, same, hero, clash] = result.files;

    expect(first?.planned).toBeUndefined();
    // The same bytes went into 1:1's file; another layer's bytes held hero-photo.png.
    expect(same?.planned).toBe(join(dir, "photo-1-2.png"));
    expect(same?.path).toBe(first?.path);
    expect(hero?.planned).toBeUndefined();
    expect(clash).toMatchObject({
      planned: join(dir, "hero-photo.png"),
      path: join(dir, "hero-photo-2.png"),
    });
    expect(result.notes.join("\n")).toMatch(/1:4.*hero-photo-2\.png/);
  });

  it("remembers each file it writes as its layer's, so design_apply knows a render sent back", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const files = memoryFiles();
    const result = await exportAssets(
      new PluginClient(file().bridge),
      {
        nodes: ["1:3", "1:4"],
        dir,
        original: false,
      },
      files,
    );
    const known = await files.read();

    expect(result.files).toHaveLength(2);

    for (const written of result.files) {
      expect(
        known.get(
          createHash("sha1")
            .update(await readFile(written.path))
            .digest("hex"),
        ),
      ).toContain(written.node);
    }
  });

  it("exports in the format asked for, at the scale asked for, rasters at 2x by default", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const { bridge, exported } = file();

    await exportAssets(new PluginClient(bridge), {
      nodes: ["1:5"],
      dir,
      original: false,
    });
    await exportAssets(new PluginClient(bridge), {
      nodes: ["1:6"],
      dir,
      format: "JPG",
      scale: 3,
      original: false,
    });
    await exportAssets(new PluginClient(bridge), {
      nodes: ["1:7"],
      dir,
      format: "PDF",
      original: false,
    });

    expect(exported.map(({ node, format, scale }) => [node, format, scale])).toEqual([
      ["1:5", "PNG", 2],
      ["1:6", "JPG", 3],
      ["1:7", "PDF", 1],
    ]);
  });

  it("writes the images as placed with their real extension when asked for originals", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(new PluginClient(file().bridge), {
      nodes: ["1:5"],
      dir,
      original: true,
    });

    expect(result.files).toEqual([
      {
        node: "1:5",
        kind: "image",
        format: "JPG",
        path: join(dir, "photo-1-5.jpg"),
        // A plan names an original .png before its bytes say JPEG.
        planned: join(dir, "photo-1-5.png"),
        bytes: JPEG.length,
      },
    ]);
  });

  it("exports every true asset inside a layer, like design_read plans them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(new PluginClient(file().bridge), {
      from: "54:434",
      dir,
      original: false,
    });

    expect(result.files.map(({ node, kind }) => [node, kind])).toEqual([
      ["54:437", "icon"],
      ["54:441", "icon"],
      ["54:445", "icon"],
      ["54:452", "icon"],
      ["54:454", "image"],
      ["54:456", "image"],
    ]);
  });

  it("refuses both nodes and from, or neither", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));

    await expect(
      exportAssets(new PluginClient(file().bridge), {
        nodes: ["1:1"],
        from: "54:434",
        dir,
        original: false,
      }),
    ).rejects.toThrow(/nodes or from/);
    await expect(
      exportAssets(new PluginClient(file().bridge), {
        dir,
        original: false,
      }),
    ).rejects.toThrow(/nodes or from/);
  });
});

describe("assets_export names", () => {
  it("names a layer's file as names says, slugged, and the others after their layer; a clash still gets -2", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(new PluginClient(file().bridge), {
      nodes: ["1:5", "1:6", "1:7", "1:3", "1:4"],
      dir,
      names: {
        "1:5": "Hero / Mountains",
        "1:6": "hero-mountains",
        "1:7": "../../outside",
      },
      original: false,
    });

    expect(result.errors).toEqual([]);
    expect(result.files.map((written) => written.path)).toEqual([
      join(dir, "hero-mountains.png"),
      join(dir, "hero-mountains-2.png"),
      // A name is a file name, never a path out of dir.
      join(dir, "outside.png"),
      join(dir, "hero-photo.png"),
      join(dir, "hero-photo-2.png"),
    ]);
    expect((await readdir(dir)).sort()).toEqual([
      "hero-mountains-2.png",
      "hero-mountains.png",
      "hero-photo-2.png",
      "hero-photo.png",
      "outside.png",
    ]);
  });

  it("still writes the same bytes once, whatever names each layer asks for", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(new PluginClient(file().bridge), {
      nodes: ["1:1", "1:2"],
      dir,
      names: {
        "1:1": "first",
        "1:2": "second",
      },
      original: false,
    });

    expect(result.files.map(({ path, planned }) => [path, planned])).toEqual([
      [join(dir, "first.png"), undefined],
      [join(dir, "first.png"), join(dir, "second.png")],
    ]);
    expect(await readdir(dir)).toEqual(["first.png"]);
  });

  it("names the assets inside a layer by their ids too", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(new PluginClient(file().bridge), {
      from: "54:434",
      dir,
      names: { "54:454": "Customer photo" },
      original: false,
    });

    expect(result.files.find(({ node }) => node === "54:454")?.path).toBe(join(dir, "customer-photo.png"));
  });

  it("notes an id in names that is not among the exported layers, and writes the rest", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(new PluginClient(file().bridge), {
      nodes: ["1:5", "9:9"],
      dir,
      names: {
        "1:5": "hero",
        "9:9": "missing",
        "7:7": "ghost",
      },
      original: false,
    });

    expect(result.files.map(({ path }) => path)).toEqual([join(dir, "hero.png")]);
    // 9:9 failed and is in errors already; 7:7 was never asked for.
    expect(result.errors.map(({ node }) => node)).toEqual(["9:9"]);
    expect(result.notes).toEqual([expect.stringMatching(/^names has 7:7, which is not among the layers exported/)]);
  });
});

describe("assets_export review fixes", () => {
  it("renders an icon with its strokes whatever format it is asked in", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const { bridge, exported } = file();
    const request = bridge.request;

    bridge.request = async (op, input, options) =>
      op === "snapshot"
        ? layer("7:1", "Arrow", {
            type: "VECTOR",
            strokes: [
              {
                type: "SOLID",
                color: {
                  r: 0,
                  g: 0,
                  b: 0,
                },
              },
            ],
            strokeWeight: 2,
          })
        : request(op, input, options);

    const result = await exportAssets(new PluginClient(bridge), {
      nodes: ["7:1"],
      dir,
      format: "PNG",
      original: false,
    });

    expect(exported[0]).toMatchObject({
      node: "7:1",
      format: "PNG",
      effects: true,
    });
    expect(result.files[0]).toMatchObject({
      kind: "icon",
      format: "PNG",
    });
  });
});

/** A layer 55 px wide whose render is a half-transparent 4×4 PNG, for the CSS width and WebP. */
function translucent() {
  const exported: { node: string; scale: number; format: string }[] = [];
  const png = Buffer.from(
    encode({
      width: 4,
      height: 4,
      channels: 4,
      data: new Uint8Array(64).fill(128),
    }),
  );
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
      const { node, offset = 0 } = input as { node: string; offset?: number };

      if (op === "snapshot") {
        return layer(node, "Badge", { width: 55 });
      }

      if (offset === 0) {
        exported.push(input as (typeof exported)[number]);
      }

      return {
        scale: (input as { scale: number }).scale,
        totalBytes: png.length,
        bytes: png.subarray(offset).toString("base64"),
      };
    },
  };

  return {
    bridge,
    exported,
  };
}

describe("assets_export sizes and WebP", () => {
  it("renders at the CSS width asked, times the density", async () => {
    const { bridge, exported } = translucent();

    await exportAssets(new PluginClient(bridge), {
      nodes: ["5:1"],
      dir: await mkdtemp(join(tmpdir(), "pixelwright-export-")),
      format: "PNG",
      width: 110,
      scale: 2,
      original: false,
    });

    expect(exported[0]?.scale).toBe(4);
  });

  it("refuses a CSS width Figma cannot render, naming the largest", async () => {
    const result = await exportAssets(new PluginClient(translucent().bridge), {
      nodes: ["5:1"],
      dir: await mkdtemp(join(tmpdir(), "pixelwright-export-")),
      width: 220,
      scale: 2,
      original: false,
    });

    expect(result.errors[0]?.message).toMatch(/at most 4× the layer: 110 px at 2x/);
  });

  it("writes WebP, keeping the transparency", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const { bridge, exported } = translucent();
    const result = await exportAssets(new PluginClient(bridge), {
      nodes: ["5:1"],
      dir,
      format: "WEBP",
      original: false,
    });
    const bytes = await readFile(join(dir, "badge.webp"));

    expect(exported[0]?.format).toBe("PNG");
    expect(result.files[0]).toMatchObject({
      format: "WEBP",
      path: join(dir, "badge.webp"),
    });
    expect([bytes.subarray(0, 4).toString(), bytes.subarray(8, 12).toString()]).toEqual(["RIFF", "WEBP"]);
    // VP8X with its alpha flag, or a lossless VP8L: the transparency is in the file.
    expect(bytes.subarray(12, 16).toString() === "VP8L" || (bytes[20] ?? 0) & 0x10).toBeTruthy();
  });
});
