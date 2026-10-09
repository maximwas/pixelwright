import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BridgeError } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { memoryFiles } from "../src/assets/written-files.ts";
import { exportAssets } from "../src/mcp/tools/assets.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/positivus-services-row.json", import.meta.url), "utf8"),
) as unknown;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
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
        if (node === "2:4869") {
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
    const result = await exportAssets(file().bridge, {
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

  it("remembers each file it writes as its layer's, so design_apply knows a render sent back", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const files = memoryFiles();
    const result = await exportAssets(
      file().bridge,
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

    await exportAssets(bridge, {
      nodes: ["1:5"],
      dir,
      original: false,
    });
    await exportAssets(bridge, {
      nodes: ["1:6"],
      dir,
      format: "JPG",
      scale: 3,
      original: false,
    });
    await exportAssets(bridge, {
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
    const result = await exportAssets(file().bridge, {
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
        bytes: JPEG.length,
      },
    ]);
  });

  it("exports every true asset inside a layer, like design_read plans them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));
    const result = await exportAssets(file().bridge, {
      from: "2:4869",
      dir,
      original: false,
    });

    expect(result.files.map(({ node, kind }) => [node, kind])).toEqual([
      ["I2:4873;334:1478", "icon"],
      ["2:4875", "image"],
      ["I2:4879;334:1478", "icon"],
      ["2:4881", "image"],
    ]);
  });

  it("refuses both nodes and from, or neither", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-export-"));

    await expect(
      exportAssets(file().bridge, {
        nodes: ["1:1"],
        from: "2:4869",
        dir,
        original: false,
      }),
    ).rejects.toThrow(/nodes or from/);
    await expect(
      exportAssets(file().bridge, {
        dir,
        original: false,
      }),
    ).rejects.toThrow(/nodes or from/);
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

    const result = await exportAssets(bridge, {
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
