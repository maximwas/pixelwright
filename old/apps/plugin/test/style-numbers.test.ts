import { describe, expect, it } from "vitest";
import { TokenIndex } from "../src/figma/tokens/token-index.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** Two of the file's paint styles named Black, as a real file had them (#0F0F0F and #141414). */
const blackStyle = (id: string, level: number) => ({
  id,
  name: "Black",
  type: "PAINT",
  remote: false,
  paints: [
    {
      type: "SOLID",
      visible: true,
      opacity: 1,
      color: {
        r: level,
        g: level,
        b: level,
      },
    },
  ],
});
const FIRST = blackStyle("S:1", 15 / 255);
const SECOND = blackStyle("S:2", 20 / 255);

const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        type: "RECTANGLE",
        fills: [
          {
            type: "SOLID",
            visible: true,
            opacity: 1,
            color: {
              r: 20 / 255,
              g: 20 / 255,
              b: 20 / 255,
            },
          },
        ],
        fillStyleId: "S:2",
      },
    ],
  });

const library = {
  styles: {
    "S:1": FIRST,
    "S:2": SECOND,
  },
  localStyles: { paint: [SECOND, FIRST] },
};

describe("styles that share a name", () => {
  it("are numbered in tokens_read: the second Black is --Black-2", async () => {
    installFigma(page(), library);

    const tokens = (await plugin.run("variables", { used: false })) as {
      styles: { id: string; duplicate?: number }[];
    };

    expect(tokens.styles.map(({ id, duplicate }) => [id, duplicate])).toEqual([
      ["S:2", 2],
      ["S:1", undefined],
    ]);
  });

  it("are numbered in a snapshot, though only the second is used", async () => {
    installFigma(page(), library);

    const snapshot = (await plugin.run("snapshot", { node: "1:1" })) as {
      styles: Record<string, { duplicate?: number }>;
    };

    expect(snapshot.styles["S:2"]?.duplicate).toBe(2);
  });

  it("are found apart by design_apply's token lookup", async () => {
    installFigma(page(), library);

    const index = await TokenIndex.of();

    expect(await index.style("--Black", "PAINT")).toBe("S:1");
    expect(await index.style("--Black-2", "PAINT")).toBe("S:2");
  });
});

/** Two library styles named Black, as team files have them: which one is --Black-2 must not depend on what is read. */
const LIBRARY_A = {
  ...blackStyle("S:a", 15 / 255),
  remote: true,
};
const LIBRARY_B = {
  ...blackStyle("S:b", 20 / 255),
  remote: true,
};
const filled = (id: string, styleId: string) => ({
  id,
  type: "RECTANGLE",
  fills: [],
  fillStyleId: styleId,
});
const teamLibrary = (pages: ReturnType<typeof tree>[] = []) => ({
  styles: {
    "S:a": LIBRARY_A,
    "S:b": LIBRARY_B,
  },
  pages,
});

describe("library styles that share a name", () => {
  it("get the same numbers in a snapshot of one layer, design_apply's entries, tokens_read within it and the lookup", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [filled("1:1", "S:a"), filled("1:2", "S:b")],
      }),
      teamLibrary(),
    );

    const read = (await plugin.run("snapshot", { node: "1:2" })) as {
      styles: Record<string, { duplicate?: number }>;
    };
    const entries = (await plugin.run("entries", { ids: ["1:2"] })) as {
      styles: Record<string, { duplicate?: number }>;
    };
    const tokens = (await plugin.run("variables", {
      used: true,
      within: "1:2",
    })) as { styles: { id: string; duplicate?: number }[] };
    const index = await TokenIndex.of();

    expect(read.styles["S:b"]?.duplicate).toBe(2);
    expect(entries.styles["S:b"]?.duplicate).toBe(2);
    expect(tokens.styles.find((style) => style.id === "S:b")?.duplicate).toBe(2);
    expect(await index.style("--Black", "PAINT")).toBe("S:a");
    expect(await index.style("--Black-2", "PAINT")).toBe("S:b");
  });

  it("keep their meaning in the lookup after it looked on the other pages for another name", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [filled("1:1", "S:a")],
      }),
      teamLibrary([
        tree({
          id: "0:2",
          type: "PAGE",
          children: [filled("2:1", "S:b")],
        }),
      ]),
    );

    const index = await TokenIndex.of();

    expect(await index.style("--Nope", "PAINT")).toBeNull();
    expect(await index.style("--Black", "PAINT")).toBe("S:a");
  });
});

describe("gradient paint styles", () => {
  it("take their CSS in tokens_read from a layer the style fills, as Figma writes it", async () => {
    const gradient = "radial-gradient(144.83% 129.61% at 97.4% 5.56%, #9D3535 0%, #E29B6A 100%)";

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            ...filled("1:1", "S:g"),
            css: { background: `var(--Brand-Gradient, ${gradient})` },
          },
        ],
      }),
      {
        styles: {
          "S:g": {
            id: "S:g",
            name: "Brand Gradient",
            type: "PAINT",
            remote: true,
            paints: [
              {
                type: "GRADIENT_RADIAL",
                visible: true,
                gradientStops: [],
                gradientTransform: [
                  [1, 0, 0],
                  [0, 1, 0],
                ],
              },
            ],
          },
        },
      },
    );

    const tokens = (await plugin.run("variables", { used: true })) as { styles: { id: string; css?: string }[] };

    expect(tokens.styles.find((style) => style.id === "S:g")?.css).toBe(gradient);
  });
});

describe("tokens_usage", () => {
  it("lists the layers a numbered style token names, and only those", async () => {
    const white = (id: string) => ({
      ...blackStyle(id, 1),
      name: "White",
      remote: true,
    });

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [filled("1:1", "S:w1"), filled("1:2", "S:w2"), filled("1:3", "S:w2")],
      }),
      {
        styles: {
          "S:w1": white("S:w1"),
          "S:w2": white("S:w2"),
        },
      },
    );

    await expect(plugin.run("usage", { token: "--White-2" })).resolves.toMatchObject({
      kind: "paint style",
      name: "White",
      layers: [
        {
          id: "1:2",
          property: "fill",
        },
        {
          id: "1:3",
          property: "fill",
        },
      ],
      more: false,
    });
  });

  it("looks on every page of the file when asked, the current page's layers first", async () => {
    const { writes } = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [filled("1:1", "S:w")],
      }),
      {
        styles: {
          "S:w": {
            ...blackStyle("S:w", 1),
            name: "White",
          },
        },
        pages: [
          tree({
            id: "0:2",
            type: "PAGE",
            children: [filled("2:1", "S:w")],
          }),
        ],
      },
    );
    const ids = (found: unknown) => (found as { layers: { id: string }[] }).layers.map(({ id }) => id);

    expect(ids(await plugin.run("usage", { token: "--White" }))).toEqual(["1:1"]);
    expect(
      ids(
        await plugin.run("usage", {
          token: "--White",
          within: "file",
        }),
      ),
    ).toEqual(["1:1", "2:1"]);
    expect(writes.calls.map(({ method }) => method)).toContain("loadAllPagesAsync");
  });
});

describe("same-named text styles in design_apply's lookup", () => {
  it("find the second h1 by the name reads give it, h1-2", async () => {
    const h1 = (id: string) => ({
      id,
      name: "h1",
      type: "TEXT",
      remote: false,
      fontName: {
        family: "Inter",
        style: "Bold",
      },
      fontSize: 32,
      lineHeight: { unit: "AUTO" },
      letterSpacing: {
        unit: "PIXELS",
        value: 0,
      },
      textCase: "ORIGINAL",
      textDecoration: "NONE",
    });

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [],
      }),
      {
        styles: {
          "S:t1": h1("S:t1"),
          "S:t2": h1("S:t2"),
        },
        localStyles: { text: [h1("S:t1"), h1("S:t2")] },
      },
    );

    const index = await TokenIndex.of();

    expect(await index.textStyle("h1")).toBe("S:t1");
    expect(await index.textStyle("h1-2")).toBe("S:t2");
  });
});

describe("image paint styles in tokens_read", () => {
  it("are not asked for CSS: only a gradient's is worth Figma's time", async () => {
    let asked = 0;

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            ...filled("1:1", "S:img"),
            css: { background: "url(x.png)" },
          },
        ],
      }),
      {
        styles: {
          "S:img": {
            id: "S:img",
            name: "Photo",
            type: "PAINT",
            remote: true,
            paints: [
              {
                type: "IMAGE",
                visible: true,
                imageHash: "a".repeat(40),
              },
            ],
          },
        },
      },
    );

    const layer = (globalThis as unknown as { figma: { currentPage: { children: Record<string, unknown>[] } } }).figma
      .currentPage.children[0] as Record<string, unknown>;
    const original = layer.getCSSAsync as () => Promise<unknown>;

    layer.getCSSAsync = async () => {
      asked += 1;

      return original();
    };

    await plugin.run("variables", { used: true });

    expect(asked).toBe(0);
  });
});
