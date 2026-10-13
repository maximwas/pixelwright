/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: some strings here are template sources, their ${} the templates own. */
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlannedAsset } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { writeAssets } from "../src/assets/write-assets.ts";
import { memoryFiles } from "../src/assets/written-files.ts";
import { readDesign } from "../src/design/read-design.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";
import { JPEG, PNG } from "./helpers/images.ts";

const fixture = async (name: string) =>
  JSON.parse(await readFile(new URL(`../../../packages/core/test/fixtures/${name}.json`, import.meta.url), "utf8")) as {
    root: Record<string, unknown>;
  };
const CUSTOMERS = await fixture("orbit-customers");
const PLANS = await fixture("orbit-plans");

/** The icons' SVG in these tests: the two Nova logos draw the same. */
const ICONS: Readonly<Record<string, string>> = {
  "54:437": "<svg>nova</svg>",
  "54:445": "<svg>nova</svg>",
  "54:441": "<svg>lumen</svg>",
  "54:452": "<svg>arrow</svg>",
};

/** A 100×100 PNG header: what a screenshot export returns in these tests. */
const PNG_100 = (() => {
  const png = Buffer.alloc(64, 7);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(png, 0);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(100, 16);
  png.writeUInt32BE(100, 20);

  return png;
})();

/** A plugin in the Orbit file: a layer's snapshot (Customers by default), the Nova logo twice, a PNG per image. */
function orbit(snapshot: unknown = CUSTOMERS, selected: string[] = []) {
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
        return snapshot;
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
      const icon = ICONS[node];
      const bytes = icon === undefined ? Buffer.concat([PNG, Buffer.from(node)]) : Buffer.from(icon);

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
    const { bridge } = orbit();
    const result = await readDesign(bridge, {
      node: "54:434",
      assetsDir: dir,
      screenshot: false,
      maxChars: 80_000,
    });
    const xml = textOf(result, 0);
    const meta = JSON.parse(textOf(result, 1)) as { assets: { node: string; src: string }[]; hints: string[] };

    expect((await readdir(dir)).sort()).toEqual([
      "arrow.svg",
      "avatar.png",
      "logo-lumen.svg",
      "logo-nova.svg",
      "product-shot.png",
    ]);
    expect(xml.match(new RegExp(`src="${dir}/logo-nova.svg"`, "g"))).toHaveLength(2);
    expect(meta.assets.map((asset) => asset.src)).toEqual([
      `${dir}/logo-nova.svg`,
      `${dir}/logo-lumen.svg`,
      `${dir}/logo-nova.svg`,
      `${dir}/arrow.svg`,
      `${dir}/product-shot.png`,
      `${dir}/avatar.png`,
    ]);
    expect(meta.hints).toContainEqual(expect.stringContaining("equals --color-accent"));
  });

  it("remembers each file it writes as its layer's, so design_apply knows a render sent back", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-assets-"));
    const files = memoryFiles();
    const result = await readDesign(
      orbit().bridge,
      {
        node: "54:434",
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
    const { bridge, ops } = orbit();
    const result = await readDesign(bridge, {
      node: "54:434",
      screenshot: false,
      maxChars: 80_000,
    });
    const meta = JSON.parse(textOf(result, 1)) as { assets: { written: boolean }[]; hints: string[] };

    expect(ops).toEqual(["snapshot"]);
    expect(meta.assets.every((asset) => !asset.written)).toBe(true);
    expect(meta.hints).toContainEqual(
      expect.stringMatching(/6 assets are planned but not written, so their src names are plans: pass assetsDir/),
    );
  });

  it("reads the selected layer when none is named, and refuses to guess between several", async () => {
    await expect(
      readDesign(orbit(CUSTOMERS, ["54:434", "54:435"]).bridge, {
        screenshot: false,
        maxChars: 80_000,
      }),
    ).rejects.toThrow(/2 layers are selected/);

    const result = await readDesign(orbit(CUSTOMERS, ["54:434"]).bridge, {
      screenshot: false,
      maxChars: 80_000,
    });

    expect(JSON.parse(textOf(result, 1))).toMatchObject({ node: "54:434" });
  });

  it("cuts a read past maxChars and tells how to read the rest", async () => {
    const result = await readDesign(orbit().bridge, {
      node: "54:434",
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
    const { bridge } = orbit();
    const request = bridge.request;

    bridge.request = async (op, input, options) => {
      if (op === "export") {
        inputs.push(input as (typeof inputs)[number]);
      }

      return request(op, input, options);
    };

    await readDesign(bridge, {
      node: "54:434",
      assetsDir: await mkdtemp(join(tmpdir(), "pixelwright-assets-")),
      screenshot: false,
      maxChars: 80_000,
    });

    const first = inputs.filter((input) => input.offset === 0);

    expect(first.map((input) => [input.node, input.effects])).toEqual([
      ["54:437", true],
      ["54:441", true],
      ["54:445", true],
      ["54:452", true],
      ["54:454", false],
      ["54:456", false],
    ]);
    expect(new Set(first.map((input) => input.stream)).size).toBe(6);
  });

  it("says a hidden layer cannot be read instead of returning nothing", async () => {
    const { bridge } = orbit();
    const request = bridge.request;

    bridge.request = async (op, input, options) =>
      op === "snapshot"
        ? {
            ...CUSTOMERS,
            root: {
              ...CUSTOMERS.root,
              visible: false,
            },
          }
        : request(op, input, options);

    await expect(
      readDesign(bridge, {
        node: "54:434",
        screenshot: false,
        maxChars: 80_000,
      }),
    ).rejects.toThrow(/hidden/);
  });

  it("takes the screenshot from the file the read came from", async () => {
    const sessions: string[] = [];
    const { bridge } = orbit();
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
      node: "54:434",
      screenshot: true,
      maxChars: 80_000,
    });

    expect(new Set(sessions.map((entry) => entry.split(":")[1]))).toEqual(new Set(["s1"]));
  });
});

const PLAN_CARD = `// url=https://www.figma.com/design/KIT/Kit?node-id=9-9
// component=Plan Card
import figma from 'figma'

const card = figma.selectedInstance
const name = card.getString('Name')
const price = card.getString('Price')
const popular = card.getBoolean('Popular')

export default {
  example: figma.code\`<PlanCard name="\${name}" price="\${price}"\${popular ? ' popular' : ''} />\`,
  imports: ['import { PlanCard } from "@/components/PlanCard"'],
  id: 'plan-card',
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

/** The Orbit plugin reading the Plans row, its snapshot changed: some branch edited, or one layer of it alone. */
function plansWith(change: (row: { root: Record<string, unknown> }) => { root: unknown }) {
  const { bridge } = orbit(PLANS);

  return {
    ...bridge,
    request: async (op: string, input: unknown, target?: unknown) =>
      op === "snapshot"
        ? change(structuredClone(PLANS) as { root: Record<string, unknown> })
        : bridge.request(op, input, target as never),
  } as BridgeView;
}

/** A layer of the snapshot by id. */
function layerOf(root: Record<string, unknown>, id: string): Record<string, unknown> | undefined {
  if (root.id === id) {
    return root;
  }

  for (const child of (root.children as Record<string, unknown>[] | undefined) ?? []) {
    const found = layerOf(child, id);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

describe("design_read with the project's Code Connect templates", () => {
  const args = {
    node: "54:243",
    screenshot: false,
    maxChars: 80_000,
  };
  const plans = () => orbit(PLANS).bridge;

  it("gives each connected instance's code and collapses it in the XML", async () => {
    const root = await project({ "PlanCard.figma.ts": PLAN_CARD });
    const result = await readDesign(plans(), args, memoryFiles(), root);
    const xml = textOf(result, 0);
    const meta = JSON.parse(textOf(result, 1)) as Record<string, unknown>;
    const imports = ['import { PlanCard } from "@/components/PlanCard"'];

    expect(meta.codeComponents).toEqual([
      {
        ids: ["54:244"],
        component: "Plan Card",
        template: "PlanCard.figma.ts",
        snippet: '<PlanCard name="Starter" price="$0" />',
        imports,
      },
      {
        ids: ["54:268"],
        component: "Plan Card",
        template: "PlanCard.figma.ts",
        snippet: '<PlanCard name="Pro" price="$12" popular />',
        imports,
      },
      {
        ids: ["54:292"],
        component: "Plan Card",
        template: "PlanCard.figma.ts",
        snippet: '<PlanCard name="Team" price="$29" />',
        imports,
      },
    ]);
    expect(meta.imports).toEqual(imports);
    expect(meta).not.toHaveProperty("codeErrors");
    expect(xml).toMatch(/<Instance id="54:244" name="Plan – Starter" component="Plan Card"[^>]* \$code="Plan Card"\/>/);
    // The card's own layers are left out; its properties stay on it.
    expect(xml).not.toContain('<Text id="I54:244;54:207"');
  });

  it("lists instances whose code is the same once, with all their ids", async () => {
    const root = await project({
      "PlanCard.figma.ts": PLAN_CARD.replace("${name}", "plan")
        .replace("${price}", "")
        .replace("${popular ? ' popular' : ''}", ""),
    });
    const meta = JSON.parse(textOf(await readDesign(plans(), args, memoryFiles(), root), 1)) as {
      codeComponents: { ids: string[]; snippet: string }[];
    };

    expect(meta.codeComponents).toEqual([
      expect.objectContaining({
        ids: ["54:244", "54:268", "54:292"],
        snippet: '<PlanCard name="plan" price="" />',
      }),
    ]);
  });

  it("keeps an instance whose template fails as it is, and lists the error once per template", async () => {
    const root = await project({ "PlanCard.figma.ts": PLAN_CARD.replace("getString('Name')", "getString('Title')") });
    const result = await readDesign(plans(), args, memoryFiles(), root);
    const meta = JSON.parse(textOf(result, 1)) as Record<string, unknown>;

    expect(meta.codeComponents).toEqual([]);
    expect(meta.codeErrors).toEqual([
      {
        template: "PlanCard.figma.ts",
        error: expect.stringMatching(/^PROPERTY_NOT_FOUND: Plan – Starter \(54:244\) has no property Title/),
        ids: ["54:244", "54:268", "54:292"],
      },
    ]);
    expect(textOf(result, 0)).toContain('<Text id="I54:244;54:207"');
  });

  it("renders no instance whose layers the read left out, and says how to read it whole", async () => {
    const root = await project({ "PlanCard.figma.ts": PLAN_CARD });
    const bridge = plansWith((row) => {
      const starter = layerOf(row.root, "54:244") as Record<string, unknown>;

      // What a depth-limited read or the plugin's size budget leaves: the count of children, none of them.
      starter.children = [];

      return row;
    });
    const result = await readDesign(bridge, args, memoryFiles(), root);
    const meta = JSON.parse(textOf(result, 1)) as {
      codeComponents: { ids: string[] }[];
      codeErrors: { error: string; ids: string[] }[];
    };

    expect(meta.codeComponents.map(({ ids }) => ids)).toEqual([["54:268"], ["54:292"]]);
    expect(meta.codeErrors).toEqual([
      expect.objectContaining({
        ids: ["54:244"],
        error: expect.stringMatching(/^TEMPLATE_CUT: .*design_read node=54:244/),
      }),
    ]);
    expect(textOf(result, 0)).toMatch(/<Instance id="54:244"[^>]*\$children="5"/);
  });

  it("reads the asked layer's own layers even when a template connects it, and every layer with code: false", async () => {
    const root = await project({ "PlanCard.figma.ts": PLAN_CARD });
    const starter = plansWith((row) => ({
      ...row,
      root: layerOf(row.root, "54:244"),
    }));
    const own = await readDesign(
      starter,
      {
        ...args,
        node: "54:244",
      },
      memoryFiles(),
      root,
    );
    const off = await readDesign(
      plans(),
      {
        ...args,
        code: false,
      },
      memoryFiles(),
      root,
    );

    expect(textOf(own, 0)).toContain('<Text id="I54:244;54:207"');
    expect(JSON.parse(textOf(own, 1))).toMatchObject({
      codeComponents: [expect.objectContaining({ ids: ["54:244"] })],
    });
    expect(textOf(off, 0)).toContain('<Text id="I54:244;54:207"');
    expect(JSON.parse(textOf(off, 1))).not.toHaveProperty("codeComponents");
  });

  it("keeps the code within a share of maxChars, reading the instances past it as layers", async () => {
    const root = await project({
      "PlanCard.figma.ts": PLAN_CARD.replace('name="${name}"', "name=\"${name} ${'x'.repeat(3000)}\""),
    });
    const result = await readDesign(
      plans(),
      {
        ...args,
        maxChars: 12_000,
      },
      memoryFiles(),
      root,
    );
    const meta = JSON.parse(textOf(result, 1)) as { codeComponents: { ids: string[] }[]; hints: string[] };

    expect(meta.codeComponents.map(({ ids }) => ids)).toEqual([["54:244"]]);
    expect(meta.hints).toContainEqual(expect.stringMatching(/^Code Connect: 2 more connected instances/));
  });

  it("reads as before in a project without templates", async () => {
    const plain = await readDesign(plans(), args);
    const empty = await readDesign(plans(), args, memoryFiles(), await project({ "README.md": "hi" }));

    expect(empty.content).toEqual(plain.content);
    expect(JSON.parse(textOf(empty, 1))).not.toHaveProperty("codeComponents");
  });
});
