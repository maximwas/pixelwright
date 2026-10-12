import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlannedAsset } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { writeAssets } from "../src/assets/write-assets.ts";
import { memoryFiles } from "../src/assets/written-files.ts";
import { readDesign } from "../src/mcp/tools/design.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";
import { JPEG, PNG } from "./helpers/images.ts";

const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/positivus-services-row.json", import.meta.url), "utf8"),
) as unknown;

/** A 100×100 PNG header: what a screenshot export returns in these tests. */
const PNG_100 = (() => {
  const png = Buffer.alloc(64, 7);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(png, 0);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(100, 16);
  png.writeUInt32BE(100, 20);

  return png;
})();

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

  it("remembers each file it writes as its layer's, so design_apply knows a render sent back", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-assets-"));
    const files = memoryFiles();
    const result = await readDesign(
      positivus().bridge,
      {
        node: "2:4869",
        assetsDir: dir,
        screenshot: false,
        maxChars: 80_000,
      },
      files,
    );
    const meta = JSON.parse(textOf(result, 1)) as { assets: { node: string; src: string }[] };
    const known = await files.read();

    for (const asset of meta.assets) {
      expect(
        known.get(
          createHash("sha1")
            .update(await readFile(asset.src))
            .digest("hex"),
        ),
      ).toContain(asset.node);
    }
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
    const { written } = await writeAssets(
      assets,
      async (asset) => bytes[asset.node] ?? PNG,
      dir,
      "assets",
      memoryFiles(),
    );

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
      memoryFiles(),
    );

    expect(written.map((asset) => asset.src)).toEqual(["assets/icon-2.svg", "assets/logo.svg"]);
    expect(await readFile(join(dir, "icon.svg"), "utf8")).toBe("<svg>first read</svg>");
  });
});

describe("design_read review fixes", () => {
  it("exports icons with their strokes and images as their own box, each export its own stream", async () => {
    const inputs: { node: string; effects: boolean; stream?: string; offset: number }[] = [];
    const { bridge } = positivus();
    const request = bridge.request;

    bridge.request = async (op, input, options) => {
      if (op === "export") {
        inputs.push(input as (typeof inputs)[number]);
      }

      return request(op, input, options);
    };

    await readDesign(bridge, {
      node: "2:4869",
      assetsDir: await mkdtemp(join(tmpdir(), "pixelwright-assets-")),
      screenshot: false,
      maxChars: 80_000,
    });

    const first = inputs.filter((input) => input.offset === 0);

    expect(first.map((input) => [input.node, input.effects])).toEqual([
      ["I2:4873;334:1478", true],
      ["2:4875", false],
      ["I2:4879;334:1478", true],
      ["2:4881", false],
    ]);
    expect(new Set(first.map((input) => input.stream)).size).toBe(4);
  });

  it("says a hidden layer cannot be read instead of returning nothing", async () => {
    const { bridge } = positivus();
    const request = bridge.request;

    bridge.request = async (op, input, options) =>
      op === "snapshot"
        ? {
            ...(ROW as object),
            root: {
              ...(ROW as { root: object }).root,
              visible: false,
            },
          }
        : request(op, input, options);

    await expect(
      readDesign(bridge, {
        node: "2:4869",
        screenshot: false,
        maxChars: 80_000,
      }),
    ).rejects.toThrow(/hidden/);
  });

  it("takes the screenshot from the file the read came from", async () => {
    const sessions: string[] = [];
    const { bridge } = positivus();
    const request = bridge.request;
    let active = "s1";

    bridge.plugins = () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: active === "s1",
      },
      {
        session: "s2",
        info: pluginInfo({
          instanceId: "other",
          file: {
            name: "Other",
            key: null,
          },
        }),
        active: active === "s2",
      },
    ];
    bridge.request = async (op, input, options) => {
      sessions.push(`${op}:${options?.session}`);
      // The user switches files while the read runs.
      active = "s2";

      return op === "export"
        ? {
            scale: 1,
            totalBytes: PNG_100.length,
            bytes: PNG_100.toString("base64"),
          }
        : request(op, input, options);
    };

    await readDesign(bridge, {
      node: "2:4869",
      screenshot: true,
      maxChars: 80_000,
    });

    expect(new Set(sessions.map((entry) => entry.split(":")[1]))).toEqual(new Set(["s1"]));
  });
});

const HEADING = `// url=https://www.figma.com/design/KIT/Kit?node-id=9-9
// component=Heading
import figma from 'figma'

const heading = figma.selectedInstance
const tone = heading.getEnum('Property 1', { Green: 'green', White: 'white', Black: 'black' })
const words = heading.findLayers((layer) => layer.type === 'TEXT').map((text) => text.textContent).join(' ')

export default {
  example: figma.code\`<Heading tone="\${tone}">\${words}</Heading>\`,
  imports: ['import { Heading } from "@/components/Heading"'],
  id: 'heading',
}
`;

/** A project folder with these template files. */
async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-project-"));

  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(root, name), text);
  }

  return root;
}

describe("design_read with the project's Code Connect templates", () => {
  const args = {
    node: "2:4869",
    screenshot: false,
    maxChars: 80_000,
  };

  it("gives each connected instance's code and collapses it in the XML", async () => {
    const root = await project({ "Heading.figma.ts": HEADING });
    const result = await readDesign(positivus().bridge, args, memoryFiles(), root);
    const xml = textOf(result, 0);
    const meta = JSON.parse(textOf(result, 1)) as Record<string, unknown>;

    expect(meta.codeComponents).toEqual([
      {
        id: "2:4872",
        component: "Heading",
        template: "Heading.figma.ts",
        snippet: '<Heading tone="green">Search engine optimization</Heading>',
        imports: ['import { Heading } from "@/components/Heading"'],
      },
      {
        id: "2:4878",
        component: "Heading",
        template: "Heading.figma.ts",
        snippet: '<Heading tone="white">Pay-per-click advertising</Heading>',
        imports: ['import { Heading } from "@/components/Heading"'],
      },
    ]);
    expect(meta.imports).toEqual(['import { Heading } from "@/components/Heading"']);
    expect(xml).toContain(
      '<Instance id="2:4872" name="Heading" component="Heading" variant="Property 1=Green" display="flex" flex-direction="column" $code="Heading"/>',
    );
    expect(xml).not.toContain("Search engine");
    // The Link instances have no template: written as before.
    expect(xml).toContain("Learn more");
  });

  it("keeps an instance whose template fails as it is, and lists the error", async () => {
    const root = await project({ "Heading.figma.ts": HEADING.replace("'Property 1'", "'Tone'") });
    const result = await readDesign(positivus().bridge, args, memoryFiles(), root);
    const meta = JSON.parse(textOf(result, 1)) as { codeComponents: unknown[] };

    expect(meta.codeComponents).toEqual([
      {
        id: "2:4872",
        template: "Heading.figma.ts",
        error: expect.stringMatching(/^PROPERTY_NOT_FOUND: Heading \(2:4872\) has no property Tone/),
      },
      expect.objectContaining({
        id: "2:4878",
        error: expect.stringMatching(/^PROPERTY_NOT_FOUND/),
      }),
    ]);
    expect(textOf(result, 0)).toContain("Search engine");
  });

  it("reads as before in a project without templates", async () => {
    const plain = await readDesign(positivus().bridge, args);
    const empty = await readDesign(positivus().bridge, args, memoryFiles(), await project({ "README.md": "hi" }));

    expect(empty.content).toEqual(plain.content);
    expect(JSON.parse(textOf(empty, 1))).not.toHaveProperty("codeComponents");
  });
});
