import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlannedAsset } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { writeAssets } from "../src/assets/write-assets.ts";
import { readDesign } from "../src/mcp/tools/design.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/positivus-services-row.json", import.meta.url), "utf8"),
) as unknown;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

/** A plugin in the Positivus file: the Services row snapshot, the same arrow icon twice, a different PNG per image. */
function positivus(selected: string[] = []) {
  const ops: string[] = [];
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
      ops.push(op);

      if (op === "snapshot") {
        return ROW;
      }

      if (op === "selection") {
        return {
          nodes: selected.map((id) => ({
            id,
            name: id,
            type: "FRAME",
            box: null,
          })),
        };
      }

      const { node, offset } = input as { node: string; offset: number };
      const bytes = node.endsWith("334:1478")
        ? Buffer.from("<svg>arrow</svg>")
        : Buffer.concat([PNG, Buffer.from(node)]);

      return {
        scale: 2,
        totalBytes: bytes.length,
        bytes: bytes.subarray(offset).toString("base64"),
      };
    },
  };

  return {
    bridge,
    ops,
  };
}

const textOf = (result: Awaited<ReturnType<typeof readDesign>>, index: number) =>
  (result.content[index] as { text: string }).text;

describe("design_read", () => {
  it("writes each asset once and points the XML at the files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-assets-"));
    const { bridge } = positivus();
    const result = await readDesign(bridge, {
      node: "2:4869",
      assetsDir: dir,
      screenshot: false,
      maxChars: 80_000,
    });
    const xml = textOf(result, 0);
    const meta = JSON.parse(textOf(result, 1)) as { assets: { node: string; src: string }[]; hints: string[] };

    expect((await readdir(dir)).sort()).toEqual([
      "icon.svg",
      "tokyo-magnifier-web-search-with-elements-2.png",
      "tokyo-selecting-a-value-in-the-browser-window-1.png",
    ]);
    expect(xml.match(new RegExp(`src="${dir}/icon.svg"`, "g"))).toHaveLength(2);
    expect(meta.assets.map((asset) => asset.src)).toEqual([
      `${dir}/icon.svg`,
      `${dir}/tokyo-magnifier-web-search-with-elements-2.png`,
      `${dir}/icon.svg`,
      `${dir}/tokyo-selecting-a-value-in-the-browser-window-1.png`,
    ]);
    expect(meta.hints).toContainEqual(expect.stringContaining("equals --Dark"));
  });

  it("plans the assets without writing them when no folder is given, and says so", async () => {
    const { bridge, ops } = positivus();
    const result = await readDesign(bridge, {
      node: "2:4869",
      screenshot: false,
      maxChars: 80_000,
    });
    const meta = JSON.parse(textOf(result, 1)) as { assets: { written: boolean }[]; hints: string[] };

    expect(ops).toEqual(["snapshot"]);
    expect(meta.assets.every((asset) => !asset.written)).toBe(true);
    expect(meta.hints).toContainEqual(expect.stringMatching(/4 assets are planned but not written: pass assetsDir/));
  });

  it("reads the selected layer when none is named, and refuses to guess between several", async () => {
    await expect(
      readDesign(positivus(["2:4869", "2:4870"]).bridge, {
        screenshot: false,
        maxChars: 80_000,
      }),
    ).rejects.toThrow(/2 layers are selected/);

    const result = await readDesign(positivus(["2:4869"]).bridge, {
      screenshot: false,
      maxChars: 80_000,
    });

    expect(JSON.parse(textOf(result, 1))).toMatchObject({ node: "2:4869" });
  });

  it("cuts a read past maxChars and tells how to read the rest", async () => {
    const result = await readDesign(positivus().bridge, {
      node: "2:4869",
      screenshot: false,
      maxChars: 2_000,
    });
    const meta = JSON.parse(textOf(result, 1)) as { truncated: string[]; hints: string[] };

    expect(textOf(result, 0).length).toBeLessThanOrEqual(2_000);
    expect(meta.truncated.length).toBeGreaterThan(0);
    expect(meta.hints).toContainEqual(expect.stringMatching(/read each with design_read node=<id>/));
  });
});

describe("writeAssets", () => {
  it("names an original image by what it really is, and suffixes a second file under a taken name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-assets-"));
    const assets: PlannedAsset[] = [
      {
        node: "1:1",
        kind: "image",
        format: "PNG",
        src: "assets/hero-background.png",
        imageHash: "a".repeat(40),
      },
      {
        node: "1:2",
        kind: "image",
        format: "PNG",
        src: "assets/hero-background.png",
      },
    ];
    const bytes: Record<string, Buffer> = {
      "1:1": JPEG,
      "1:2": Buffer.concat([PNG, Buffer.from("other")]),
    };
    const { written } = await writeAssets(assets, async (asset) => bytes[asset.node] ?? PNG, dir, "assets");

    expect(written.map((asset) => asset.src)).toEqual(["assets/hero-background.jpg", "assets/hero-background.png"]);
    expect((await readFile(join(dir, "hero-background.jpg"))).equals(JPEG)).toBe(true);
  });
});

describe("writeAssets into a folder an earlier read wrote", () => {
  it("reuses a file with the same bytes and never overwrites one with other bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-assets-"));
    const { writeFile } = await import("node:fs/promises");

    await writeFile(join(dir, "icon.svg"), "<svg>first read</svg>");
    await writeFile(join(dir, "logo.svg"), "<svg>logo</svg>");

    const { written } = await writeAssets(
      [
        {
          node: "1:1",
          kind: "icon",
          format: "SVG",
          src: "assets/icon.svg",
        },
        {
          node: "1:2",
          kind: "icon",
          format: "SVG",
          src: "assets/logo.svg",
        },
      ],
      async (asset) => Buffer.from(asset.node === "1:1" ? "<svg>second read</svg>" : "<svg>logo</svg>"),
      dir,
      "assets",
    );

    expect(written.map((asset) => asset.src)).toEqual(["assets/icon-2.svg", "assets/logo.svg"]);
    expect(await readFile(join(dir, "icon.svg"), "utf8")).toBe("<svg>first read</svg>");
  });
});
