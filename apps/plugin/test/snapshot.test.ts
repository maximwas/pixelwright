import { OPERATION_SCHEMAS } from "@pixelwright/core";
import { beforeEach, describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { FAKE_MIXED, installFigma, tree } from "./helpers/fake-figma.ts";

const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
};
const segment = {
  characters: "Search engine",
  start: 0,
  end: 13,
  fontName: {
    family: "Space Grotesk",
    style: "Medium",
  },
  fontSize: 30,
  fontWeight: 500,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: { unit: "AUTO" },
  letterSpacing: {
    unit: "PIXELS",
    value: 0,
  },
  fills: [],
  fillStyleId: "",
  textStyleId: "S:h3",
};

beforeEach(() => {
  installFigma(
    tree({
      id: "0:1",
      type: "PAGE",
      children: [
        {
          id: "2:4869",
          name: "Services row",
          absoluteBoundingBox: {
            x: 100,
            y: 1102,
            width: 1240,
            height: 310,
          },
          layoutMode: "HORIZONTAL",
          itemSpacing: 40,
          paddingTop: 0,
          rotation: 0,
          opacity: 1,
          fills: [],
          css: { display: "flex" },
          children: [
            {
              id: "2:4870",
              name: "Card",
              absoluteBoundingBox: {
                x: 100,
                y: 1102,
                width: 600,
                height: 310,
              },
              fills: [
                {
                  type: "SOLID",
                  color: DARK,
                  boundVariables: {
                    color: {
                      type: "VARIABLE_ALIAS",
                      id: "V:dark",
                    },
                  },
                },
              ],
              fillStyleId: "S:grey",
              cornerRadius: 45,
              children: [
                {
                  id: "2:4871",
                  name: "Heading",
                  type: "TEXT",
                  absoluteBoundingBox: {
                    x: 150,
                    y: 1152,
                    width: 300,
                    height: 38,
                  },
                  fills: FAKE_MIXED,
                  textStyleId: "S:h3",
                  characters: "Search engine",
                  textAutoResize: "WIDTH_AND_HEIGHT",
                  textAlignHorizontal: "LEFT",
                  textAlignVertical: "TOP",
                  segments: [segment],
                },
              ],
            },
            {
              id: "2:4872",
              name: "Draft",
              visible: false,
              fills: [{ type: "SOLID" }],
              children: [{ id: "2:4880" }],
            },
            {
              id: "2:4873",
              name: "Link",
              type: "INSTANCE",
              mainComponent: {
                id: "330:291",
                key: "abc",
                name: "Property 1=Black",
                parent: {
                  type: "COMPONENT_SET",
                  id: "330:290",
                  name: "Link",
                },
              },
              componentProperties: {
                "Property 1": {
                  type: "VARIANT",
                  value: "Black",
                },
              },
            },
          ],
        },
      ],
    }),
    {
      styles: {
        "S:grey": {
          name: "Grey",
          type: "PAINT",
          remote: false,
          paints: [
            {
              type: "SOLID",
              color: DARK,
            },
          ],
        },
        "S:h3": {
          name: "h3",
          type: "TEXT",
          remote: false,
          fontName: segment.fontName,
          fontSize: 30,
          lineHeight: { unit: "AUTO" },
          letterSpacing: segment.letterSpacing,
          textCase: "ORIGINAL",
          textDecoration: "NONE",
        },
      },
      variables: {
        "V:dark": {
          name: "Colors/Dark",
          variableCollectionId: "C:1",
          resolvedType: "COLOR",
          codeSyntax: { WEB: "var(--dark)" },
          value: DARK,
        },
      },
      collections: { "C:1": { name: "Brand" } },
    },
  );
});

interface Shot {
  root: Record<string, unknown> & { children?: (Record<string, unknown> & { children?: Record<string, unknown>[] })[] };
  styles: Record<string, unknown>;
  variables: Record<string, unknown>;
}

describe("snapshot", () => {
  it("answers what the server's schema expects", async () => {
    const answer = await runOperation("snapshot", {
      node: "2:4869",
      css: "all",
    });

    expect(() => OPERATION_SCHEMAS.snapshot.output.parse(answer)).not.toThrow();
  });

  it("measures every layer from the root and leaves Figma's defaults out", async () => {
    const { root } = (await runOperation("snapshot", { node: "2:4869" })) as Shot;
    const [card] = root.children ?? [];

    expect(root).toMatchObject({
      x: 0,
      y: 0,
      width: 1240,
      layoutMode: "HORIZONTAL",
      itemSpacing: 40,
      childCount: 3,
    });
    expect(root).not.toHaveProperty("rotation");
    expect(root).not.toHaveProperty("opacity");
    expect(root).not.toHaveProperty("fills");
    expect(root).not.toHaveProperty("css");
    expect(card?.children?.[0]).toMatchObject({
      x: 50,
      y: 50,
      fills: "mixed",
      text: {
        characters: "Search engine",
        segments: [segment],
      },
    });
  });

  it("keeps a hidden layer as a name and a box, without its properties or children", async () => {
    const { root } = (await runOperation("snapshot", { node: "2:4869" })) as Shot;

    expect(root.children?.[1]).toEqual({
      id: "2:4872",
      name: "Draft",
      type: "FRAME",
      visible: false,
      x: -100,
      y: -1102,
      width: 100,
      height: 100,
      childCount: 1,
    });
  });

  it("names the component of an instance and its properties", async () => {
    const { root } = (await runOperation("snapshot", { node: "2:4869" })) as Shot;

    expect(root.children?.[2]?.instance).toEqual({
      componentId: "330:291",
      componentName: "Property 1=Black",
      componentKey: "abc",
      setId: "330:290",
      setName: "Link",
      properties: {
        "Property 1": {
          type: "VARIANT",
          value: "Black",
        },
      },
    });
  });

  it("marks an instance of a library's component, whose id in this file is not the library's", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "5:1",
            name: "Chip",
            type: "INSTANCE",
            mainComponent: {
              id: "5:9",
              key: "lib",
              name: "Chip",
              remote: true,
              parent: null,
            },
            componentProperties: {},
          },
        ],
      }),
    );

    const { root } = (await runOperation("snapshot", { node: "5:1" })) as Shot;

    expect(root.instance).toMatchObject({
      componentId: "5:9",
      remote: true,
    });
  });

  it("resolves the styles and variables the layers use, once each", async () => {
    const { styles, variables } = (await runOperation("snapshot", { node: "2:4869" })) as Shot;

    expect(Object.keys(styles).sort()).toEqual(["S:grey", "S:h3"]);
    expect(styles["S:h3"]).toMatchObject({
      name: "h3",
      type: "TEXT",
      fontSize: 30,
    });
    expect(variables).toEqual({
      "V:dark": {
        name: "Colors/Dark",
        collection: "Brand",
        resolvedType: "COLOR",
        remote: false,
        value: DARK,
        codeSyntax: { WEB: "var(--dark)" },
      },
    });
  });

  it("stops at the depth asked for, and adds Figma's CSS only when asked", async () => {
    const { root } = (await runOperation("snapshot", {
      node: "2:4869",
      depth: 0,
      css: "all",
    })) as Shot;

    expect(root.children).toBeUndefined();
    expect(root.childCount).toBe(3);
    expect(root.css).toEqual({ display: "flex" });
  });
});

describe("snapshot of more than one answer can carry", () => {
  it("lists layers until its size budget, and keeps the full child count", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "1:1",
            children: Array.from({ length: 2_000 }, (_, index) => ({
              id: `1:${index + 2}`,
              name: "x".repeat(1_000),
            })),
          },
        ],
      }),
    );

    const { root } = (await runOperation("snapshot", { node: "1:1" })) as Shot;

    expect(root.childCount).toBe(2_000);
    expect(root.children?.length).toBeGreaterThan(500);
    expect(root.children?.length).toBeLessThan(2_000);
  });
});

describe("snapshot of a mirrored layer", () => {
  it("keeps the matrix that tells a flip from a turn, and the box it covers", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "2:4893",
            rotation: -180,
            absoluteBoundingBox: {
              x: 1080,
              y: 408,
              width: 210,
              height: 192,
            },
            absoluteTransform: [
              [-1, 0, 1290],
              [0, 1, 408],
            ],
            relativeTransform: [
              [-1, 0, 210],
              [0, 1, 0],
            ],
          },
        ],
      }),
    );

    const { root } = (await runOperation("snapshot", { node: "2:4893" })) as Shot;

    expect(root).toMatchObject({
      rotation: -180,
      mirrorTransform: [-1, 0, 0, 1],
      bounds: {
        x: -210,
        y: 0,
        width: 210,
        height: 192,
      },
    });
  });
});

describe("snapshot of what designers tell developers, and of a grid", () => {
  it("keeps notes with their category, a component's description, a prototype link and a grid child's cell", async () => {
    const { figma } = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "3:1",
            type: "FRAME",
            layoutMode: "GRID",
            gridColumnSizes: [
              {
                type: "FLEX",
                value: 1,
              },
            ],
            gridRowSizes: [{ type: "HUG" }],
            children: [
              {
                id: "3:2",
                type: "COMPONENT",
                description: "A product card.",
                annotations: [
                  {
                    label: "Opens the product page",
                    categoryId: "C:1",
                  },
                ],
                reactions: [
                  {
                    trigger: { type: "ON_CLICK" },
                    actions: [
                      {
                        type: "URL",
                        url: "https://example.com/product",
                      },
                    ],
                  },
                ],
                gridRowAnchorIndex: 0,
                gridColumnAnchorIndex: 0,
                gridRowSpan: 1,
                gridColumnSpan: 1,
                gridChildHorizontalAlign: "AUTO",
                gridChildVerticalAlign: "AUTO",
              },
            ],
          },
        ],
      }),
    );

    Object.assign(figma, {
      annotations: {
        getAnnotationCategoriesAsync: async () => [
          {
            id: "C:1",
            label: "Behavior",
          },
        ],
      },
    });

    const { root } = (await runOperation("snapshot", { node: "3:1" })) as Shot;

    expect(root).toMatchObject({
      gridColumnSizes: [
        {
          type: "FLEX",
          value: 1,
        },
      ],
      gridRowSizes: [{ type: "HUG" }],
    });
    expect(root.children?.[0]).toMatchObject({
      description: "A product card.",
      annotations: [
        {
          label: "Opens the product page",
          category: "Behavior",
        },
      ],
      href: "https://example.com/product",
      gridRowAnchorIndex: 0,
      gridColumnSpan: 1,
    });
  });

  it("keeps the properties a designer pinned in an annotation, with its note or without one", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "5:1",
            type: "FRAME",
            annotations: [
              {
                label: "API",
                properties: [{ type: "width" }, { type: "itemSpacing" }],
              },
              { properties: [{ type: "fills" }] },
              { properties: [] },
            ],
          },
        ],
      }),
    );

    const { root } = (await runOperation("snapshot", { node: "5:1" })) as Shot;

    expect(root.annotations).toEqual([
      {
        label: "API",
        pins: ["width", "itemSpacing"],
      },
      { pins: ["fills"] },
    ]);
  });

  it("asks Figma for its CSS only for layers our table cannot write, when asked for that", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "4:1",
            css: { display: "flex" },
            children: [
              {
                id: "4:2",
                fills: [
                  {
                    type: "GRADIENT_LINEAR",
                    gradientStops: [],
                  },
                ],
                css: { background: "linear-gradient(90deg, #000 0%, #FFF 100%)" },
              },
              {
                id: "4:3",
                fills: [
                  {
                    type: "SOLID",
                    color: {
                      r: 0,
                      g: 0,
                      b: 0,
                    },
                  },
                ],
                css: { background: "#000" },
              },
            ],
          },
        ],
      }),
    );

    const { root } = (await runOperation("snapshot", {
      node: "4:1",
      css: "unmapped",
    })) as Shot;

    expect(root).not.toHaveProperty("css");
    expect(root.children?.[0]?.css).toEqual({ background: "linear-gradient(90deg, #000 0%, #FFF 100%)" });
    expect(root.children?.[1]).not.toHaveProperty("css");
  });
});

describe("snapshot of a layer that draws past its box", () => {
  it("keeps the box it draws in, for an icon exported with its strokes", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "5:1",
            children: [
              {
                id: "5:2",
                type: "VECTOR",
                absoluteBoundingBox: {
                  x: 10,
                  y: 10,
                  width: 20,
                  height: 0,
                },
                absoluteRenderBounds: {
                  x: 9,
                  y: 8.5,
                  width: 22,
                  height: 3,
                },
              },
              {
                id: "5:3",
                type: "RECTANGLE",
                absoluteBoundingBox: {
                  x: 10,
                  y: 10,
                  width: 20,
                  height: 20,
                },
                absoluteRenderBounds: {
                  x: 10,
                  y: 10,
                  width: 20,
                  height: 20,
                },
              },
            ],
          },
        ],
      }),
    );

    const { root } = (await runOperation("snapshot", { node: "5:1" })) as Shot;

    expect(root.children?.[0]?.renderBounds).toEqual({
      x: 9,
      y: 8.5,
      width: 22,
      height: 3,
    });
    expect(root.children?.[1]).not.toHaveProperty("renderBounds");
  });
});

describe("vector paths in a snapshot", () => {
  it("hash a vector's paths, so two icons alike in all else still tell apart", async () => {
    const vector = (id: string, data: string) => ({
      id,
      type: "VECTOR",
      name: "flask",
      vectorPaths: [
        {
          windingRule: "NONZERO",
          data,
        },
      ],
    });

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [vector("7:1", "M0 0L10 10Z"), vector("7:2", "M0 0L10 10Z"), vector("7:3", "M0 0L20 5Z")],
      }),
    );

    const hashes = await Promise.all(
      ["7:1", "7:2", "7:3"].map(
        async (node) =>
          (
            (await runOperation("snapshot", {
              node,
              paths: true,
            })) as { root: { pathHash?: string } }
          ).root.pathHash,
      ),
    );

    expect(hashes[0]).toBeDefined();
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[2]).not.toBe(hashes[0]);
    // Only nodes_diff asks: a read does not pay for hashing every vector.
    expect(
      ((await runOperation("snapshot", { node: "7:1" })) as { root: { pathHash?: string } }).root.pathHash,
    ).toBeUndefined();
  });
});

describe("layout grids in a snapshot", () => {
  it("carry a frame's grids as Figma has them", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "7:9",
            type: "FRAME",
            name: "Desktop",
            layoutGrids: [
              {
                pattern: "COLUMNS",
                alignment: "STRETCH",
                count: 12,
                gutterSize: 24,
                offset: 80,
                visible: true,
              },
            ],
          },
        ],
      }),
    );

    const { root } = (await runOperation("snapshot", { node: "7:9" })) as { root: { layoutGrids?: unknown[] } };

    expect(root.layoutGrids).toEqual([
      expect.objectContaining({
        pattern: "COLUMNS",
        count: 12,
      }),
    ]);
  });
});
