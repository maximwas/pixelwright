import { OPERATION_SCHEMAS } from "@pixelwright/core";
import { beforeEach, describe, expect, it } from "vitest";
import { FAKE_MIXED, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

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
    const answer = await plugin.run("snapshot", {
      node: "2:4869",
      css: "all",
    });

    expect(() => OPERATION_SCHEMAS.snapshot.output.parse(answer)).not.toThrow();
  });

  it("measures every layer from the root and leaves Figma's defaults out", async () => {
    const { root } = (await plugin.run("snapshot", { node: "2:4869" })) as Shot;
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
    const { root } = (await plugin.run("snapshot", { node: "2:4869" })) as Shot;

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
    const { root } = (await plugin.run("snapshot", { node: "2:4869" })) as Shot;

    expect(root.children?.[2]).not.toHaveProperty("overrides");
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

  it("puts what an instance overrides on the layers it belongs to, an inner instance's too, not what a property carries", async () => {
    const main = (id: string) => ({
      id,
      key: id,
      name: id,
      parent: null,
    });

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "9:1",
            name: "Card",
            type: "INSTANCE",
            mainComponent: main("5:0"),
            componentProperties: {},
            overrides: [
              {
                id: "9:1",
                overriddenFields: ["width", "strokes"],
              },
              {
                id: "I9:1;5:2",
                overriddenFields: ["characters", "styledTextSegments"],
              },
              {
                id: "I9:1;5:4",
                overriddenFields: ["characters", "fills", "visible"],
              },
              {
                id: "I9:1;5:3;7:1",
                overriddenFields: ["fills"],
              },
            ],
            children: [
              { id: "I9:1;5:2" },
              {
                id: "I9:1;5:4",
                componentPropertyReferences: {
                  characters: "Label#1:0",
                  visible: "Show#1:1",
                },
              },
              {
                id: "I9:1;5:3",
                type: "INSTANCE",
                mainComponent: main("7:0"),
                componentProperties: {},
                overrides: [
                  {
                    id: "I9:1;5:3;7:1",
                    overriddenFields: ["opacity"],
                  },
                ],
                children: [{ id: "I9:1;5:3;7:1" }],
              },
            ],
          },
        ],
      }),
    );

    const { root } = (await plugin.run("snapshot", { node: "9:1" })) as Shot;
    const [title, label, inner] = root.children ?? [];

    expect(root.overrides).toEqual(["width", "strokes"]);
    expect(title?.overrides).toEqual(["characters", "styledTextSegments"]);
    expect(label?.overrides).toEqual(["fills"]);
    expect(inner).not.toHaveProperty("overrides");
    expect(inner?.children?.[0]?.overrides).toEqual(["fills", "opacity"]);
  });

  it("asks no match for a radius whose corners are bound, nor any match for design_apply's own read", async () => {
    const alias = (id: string) => ({
      type: "VARIABLE_ALIAS",
      id,
    });
    let asked = 0;
    const page = tree({
      id: "0:1",
      type: "PAGE",
      children: [
        {
          id: "6:1",
          type: "FRAME",
          cornerRadius: 8,
          boundVariables: { topLeftRadius: alias("V:r") },
          inferredVariables: {
            cornerRadius: [alias("V:r")],
            itemSpacing: [alias("V:8")],
          },
        },
      ],
    });
    const [frame] = page.children ?? [];
    const matches = frame?.inferredVariables;

    Object.defineProperty(frame, "inferredVariables", {
      get: () => {
        asked += 1;

        return matches;
      },
    });
    installFigma(page);

    const { root } = (await plugin.run("snapshot", { node: "6:1" })) as Shot;

    expect(root.inferred).toEqual({ itemSpacing: "V:8" });

    asked = 0;
    await plugin.run("entries", { ids: ["6:1"] });
    expect(asked).toBe(0);
  });

  it("finds what an instance above the read changed on it, when the read starts inside the instance", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "9:1",
            type: "INSTANCE",
            mainComponent: {
              id: "5:0",
              key: "card",
              name: "Card",
              parent: null,
            },
            componentProperties: {},
            overrides: [
              {
                id: "I9:1;5:2",
                overriddenFields: ["fills"],
              },
              {
                id: "I9:1;5:2;6:1",
                overriddenFields: ["characters"],
              },
            ],
            children: [
              {
                id: "I9:1;5:2",
                children: [{ id: "I9:1;5:2;6:1" }],
              },
            ],
          },
        ],
      }),
    );

    const { root } = (await plugin.run("snapshot", { node: "I9:1;5:2" })) as Shot;

    expect(root.overrides).toEqual(["fills"]);
    expect(root.children?.[0]?.overrides).toEqual(["characters"]);
  });

  it("keeps Figma's own variable match for an unbound spacing field when it found exactly one", async () => {
    const alias = (id: string) => ({
      type: "VARIABLE_ALIAS",
      id,
    });
    const frame = (id: string, boundVariables: object) => ({
      id,
      type: "FRAME",
      layoutMode: "VERTICAL",
      paddingLeft: 16,
      itemSpacing: 8,
      boundVariables,
      inferredVariables: {
        paddingLeft: [alias("V:16")],
        itemSpacing: [alias("V:8"), alias("V:8b")],
        height: [alias("V:16")],
      },
    });

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "6:0",
            type: "FRAME",
            children: [frame("6:1", {}), frame("6:2", { paddingLeft: alias("V:16") })],
          },
        ],
      }),
      {
        variables: {
          "V:16": {
            name: "space/16",
            variableCollectionId: "C:1",
            resolvedType: "FLOAT",
            value: 16,
          },
        },
        collections: { "C:1": { name: "Orbit" } },
      },
    );

    const { root, variables } = (await plugin.run("snapshot", { node: "6:0" })) as Shot;
    const [free, bound] = root.children ?? [];

    expect(free?.inferred).toEqual({ paddingLeft: "V:16" });
    expect(bound).not.toHaveProperty("inferred");
    expect(variables["V:16"]).toMatchObject({ name: "space/16" });
  });

  it("says the file's colour profile, and nothing where Figma does not give one", async () => {
    expect(await plugin.run("snapshot", { node: "2:4869" })).not.toHaveProperty("colorProfile");

    Object.assign(figma.root, { documentColorProfile: "DISPLAY_P3" });

    expect(await plugin.run("snapshot", { node: "2:4869" })).toMatchObject({ colorProfile: "DISPLAY_P3" });
  });

  it("reads a list's item spacing, a line's caps and a frame's grid style", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "7:1",
            type: "FRAME",
            gridStyleId: "S:grid",
            children: [
              {
                id: "7:2",
                type: "LINE",
                strokeCap: "ROUND",
                strokeWeight: 2,
                strokes: [
                  {
                    type: "SOLID",
                    visible: true,
                    color: DARK,
                  },
                ],
              },
              {
                id: "7:3",
                type: "TEXT",
                characters: "One",
                listSpacing: 8,
                segments: [
                  {
                    ...segment,
                    characters: "One",
                    end: 3,
                  },
                ],
              },
            ],
          },
        ],
      }),
      {
        styles: {
          "S:grid": {
            name: "Desktop 12",
            type: "GRID",
          },
        },
      },
    );

    const { root, styles } = (await plugin.run("snapshot", { node: "7:1" })) as Shot;
    const [line, text] = root.children ?? [];

    expect(root.gridStyleId).toBe("S:grid");
    expect(styles["S:grid"]).toMatchObject({ name: "Desktop 12" });
    expect(line?.strokeCap).toBe("ROUND");
    expect((text?.text as { listSpacing?: number } | undefined)?.listSpacing).toBe(8);
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

    const { root } = (await plugin.run("snapshot", { node: "5:1" })) as Shot;

    expect(root.instance).toMatchObject({
      componentId: "5:9",
      remote: true,
    });
  });

  it("reads an instance with a slot, whose property has no value: the slot's layers say what it holds", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "5:1",
            name: "Panel",
            type: "INSTANCE",
            mainComponent: {
              id: "5:9",
              key: "panel",
              name: "Panel",
              parent: null,
            },
            componentProperties: {
              "Content#5:8": {
                type: "SLOT",
                preferredValues: [],
              },
              "Title#5:7": {
                type: "TEXT",
                value: "Plans",
              },
            },
          },
        ],
      }),
    );

    const answer = await plugin.run("snapshot", { node: "5:1" });

    expect(() => OPERATION_SCHEMAS.snapshot.output.parse(answer)).not.toThrow();
    expect((answer as Shot).root.instance).toMatchObject({
      properties: {
        "Title#5:7": {
          type: "TEXT",
          value: "Plans",
        },
      },
    });
    expect((answer as Shot).root.instance).not.toHaveProperty(["properties", "Content#5:8"]);
  });

  it("resolves the styles and variables the layers use, once each", async () => {
    const { styles, variables } = (await plugin.run("snapshot", { node: "2:4869" })) as Shot;

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
    const { root } = (await plugin.run("snapshot", {
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

    const { root } = (await plugin.run("snapshot", { node: "1:1" })) as Shot;

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

    const { root } = (await plugin.run("snapshot", { node: "2:4893" })) as Shot;

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

    const { root } = (await plugin.run("snapshot", { node: "3:1" })) as Shot;

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

    const { root } = (await plugin.run("snapshot", { node: "5:1" })) as Shot;

    expect(root.annotations).toEqual([
      {
        label: "API",
        pins: ["width", "itemSpacing"],
      },
      { pins: ["fills"] },
    ]);
  });

  it("keeps the page's Dev Mode measurements that touch the read layers, and only those", async () => {
    const page = tree({
      id: "0:1",
      type: "PAGE",
      children: [
        {
          id: "6:1",
          type: "FRAME",
          children: [{ id: "6:2" }, { id: "6:3" }],
        },
        { id: "7:1" },
      ],
    });
    const [frame, other] = page.children ?? [];
    const [first, second] = frame?.children ?? [];
    const measurement = (start: unknown, startSide: string, end: unknown, endSide: string, freeText = "") => ({
      id: `M:${Math.random()}`,
      start: {
        node: start,
        side: startSide,
      },
      end: {
        node: end,
        side: endSide,
      },
      offset: {
        type: "INNER",
        relative: 0,
      },
      freeText,
    });

    page.getMeasurements = () => [
      ...Array.from({ length: 298 }, () => measurement(other, "LEFT", other, "RIGHT")),
      measurement(first, "RIGHT", second, "LEFT", "gap"),
      measurement(other, "TOP", second, "BOTTOM"),
    ];
    installFigma(page);

    const shot = (await plugin.run("snapshot", { node: "6:1" })) as Shot & { measurements?: unknown };

    expect(shot.measurements).toEqual([
      {
        start: {
          id: "6:2",
          side: "RIGHT",
        },
        end: {
          id: "6:3",
          side: "LEFT",
        },
        text: "gap",
      },
      {
        start: {
          id: "7:1",
          side: "TOP",
        },
        end: {
          id: "6:3",
          side: "BOTTOM",
        },
      },
    ]);
  });

  it("leaves measurements out where the page has none, or Figma has no measurements API", async () => {
    const page = tree({
      id: "0:1",
      type: "PAGE",
      children: [{ id: "6:1" }],
    });

    installFigma(page);
    expect(await plugin.run("snapshot", { node: "6:1" })).not.toHaveProperty("measurements");

    page.getMeasurements = () => [];
    expect(await plugin.run("snapshot", { node: "6:1" })).not.toHaveProperty("measurements");
  });

  it("reads Figma Motion where the API is, a style's keyframes moved to where the style starts", async () => {
    const easing = (type: string, bezier: number[]) => ({
      type,
      easingFunctionCubicBezier: {
        x1: bezier[0],
        y1: bezier[1],
        x2: bezier[2],
        y2: bezier[3],
      },
    });
    const float = (value: number) => ({
      type: "FLOAT",
      value,
    });
    const rotation = {
      id: "T:2",
      keyframeOperation: "SET",
      keyframes: [
        {
          id: "K:3",
          timelinePosition: 0.2,
          value: float(0),
          easing: easing("LINEAR", [0, 0, 1, 1]),
        },
        {
          id: "K:4",
          timelinePosition: 1.0000001,
          value: float(90),
          easing: easing("LINEAR", [0, 0, 1, 1]),
        },
      ],
    };

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "8:1",
            type: "FRAME",
            children: [
              {
                id: "8:2",
                type: "RECTANGLE",
                timelines: [
                  {
                    id: "8:0",
                    duration: 2,
                  },
                ],
                animationStyles: [
                  {
                    type: "FIGMA",
                    id: "A:1",
                    styleId: "CodeComponentId:1",
                    name: "motion.preset_name.opacity",
                    duration: 0.4000000059604645,
                    timelineOffset: 0.5,
                  },
                ],
                manualKeyframeTracks: {
                  ROTATION: {
                    id: "T:2",
                    baseValue: float(0),
                    keyframes: rotation.keyframes,
                  },
                },
                animations: {
                  OPACITY: {
                    baseValue: float(1),
                    timelineDuration: 2,
                    tracks: [
                      {
                        id: "T:1",
                        keyframeOperation: "SCALE",
                        keyframes: [
                          {
                            id: "K:1",
                            timelinePosition: 0,
                            value: float(0),
                            easing: easing("EASE_OUT", [0, 0, 0.58, 1]),
                          },
                          {
                            id: "K:2",
                            timelinePosition: 0.4000000059604645,
                            value: float(1),
                            easing: easing("EASE_OUT", [0, 0, 0.58, 1]),
                          },
                        ],
                      },
                    ],
                  },
                  ROTATION: {
                    baseValue: float(0),
                    timelineDuration: 2,
                    tracks: [rotation],
                  },
                  fills: {
                    0: {
                      baseValue: {
                        type: "COLOR",
                        value: {
                          r: 1,
                          g: 1,
                          b: 1,
                          a: 1,
                        },
                      },
                      timelineDuration: 2,
                      tracks: [],
                    },
                  },
                },
              },
            ],
          },
        ],
      }),
    );

    const read = async () => ((await plugin.run("snapshot", { node: "8:1" })) as Shot).root.children?.[0];

    expect(await read()).not.toHaveProperty("motion");

    Object.assign(figma, { motion: { figmaAnimationStyles: () => [] } });

    expect(await read()).toMatchObject({
      motion: {
        timeline: 2,
        styles: [
          {
            type: "FIGMA",
            name: "motion.preset_name.opacity",
            start: 0.5,
            duration: 0.4,
          },
        ],
        tracks: [
          {
            field: "OPACITY",
            operation: "SCALE",
            base: float(1),
            style: "motion.preset_name.opacity",
            keyframes: [
              {
                t: 0.5,
                value: float(0),
                easing: {
                  type: "EASE_OUT",
                  bezier: [0, 0, 0.58, 1],
                },
              },
              {
                t: 0.9,
                value: float(1),
                easing: {
                  type: "EASE_OUT",
                  bezier: [0, 0, 0.58, 1],
                },
              },
            ],
          },
          {
            field: "ROTATION",
            operation: "SET",
            base: float(0),
            keyframes: [
              {
                t: 0.2,
                value: float(0),
              },
              {
                t: 1,
                value: float(90),
              },
            ],
          },
        ],
      },
    });
    expect((await read())?.motion).not.toHaveProperty("tracks.1.style");
    expect((await read())?.motion).not.toHaveProperty("tracks.2");
  });

  it("places a style's keyframes by the one style a layer has, and leaves a manual track where it is", async () => {
    const float = (value: number) => ({
      type: "FLOAT",
      value,
    });
    const keyframes = (...times: (number | undefined)[]) =>
      times.map((timelinePosition, index) => ({
        id: `K:${index}`,
        timelinePosition,
        value: float(index),
        easing: { type: "LINEAR" },
      }));
    const opacity = (id: string, times: (number | undefined)[]) => ({
      OPACITY: {
        baseValue: float(1),
        timelineDuration: 2,
        tracks: [
          {
            id,
            keyframeOperation: "SET",
            keyframes: keyframes(...times),
          },
        ],
      },
    });
    const style = (type: string, name: string, timelineOffset: number) => ({
      type,
      id: `A:${name}`,
      styleId: "C:1",
      name,
      timelineOffset,
    });

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "8:1",
            type: "FRAME",
            children: [
              {
                // A custom style, the layer's only one: its track starts where the style does.
                id: "8:2",
                timelines: [],
                animationStyles: [style("CUSTOM", "Bounce in", 0.4)],
                manualKeyframeTracks: {},
                animations: opacity("T:1", [0, 0.3, undefined]),
              },
              {
                // Two styles neither of which says what it animates: the start is not known.
                id: "8:3",
                timelines: [],
                animationStyles: [
                  style("CUSTOM", "Bounce in", 0.4),
                  style("FIGMA", "motion.preset_name.text_stagger", 0.2),
                ],
                manualKeyframeTracks: {},
                animations: opacity("T:2", [0, 0.3]),
              },
              {
                // A manual opacity track beside Figma's Opacity style: on the timeline already.
                id: "8:4",
                timelines: [],
                animationStyles: [style("FIGMA", "motion.preset_name.opacity", 0.5)],
                manualKeyframeTracks: {
                  OPACITY: {
                    id: "T:3",
                    baseValue: float(1),
                    keyframes: [],
                  },
                },
                animations: opacity("T:3", [0.1, 0.2]),
              },
            ],
          },
        ],
      }),
    );
    Object.assign(figma, { motion: {} });

    const { root } = (await plugin.run("snapshot", { node: "8:1" })) as Shot;
    const [single, double, manual] = (root.children ?? []).map(
      (child) => (child.motion as { tracks: Record<string, unknown>[] }).tracks[0],
    );

    expect(single).toMatchObject({
      style: "Bounce in",
      keyframes: [{ t: 0.4 }, { t: 0.7 }],
    });
    expect(single?.keyframes).toHaveLength(2);
    expect(double).toMatchObject({
      unplaced: true,
      keyframes: [{ t: 0 }, { t: 0.3 }],
    });
    expect(double).not.toHaveProperty("style");
    expect(manual).toMatchObject({ keyframes: [{ t: 0.1 }, { t: 0.2 }] });
    expect(manual).not.toHaveProperty("style");
  });

  it("reads on without Motion or measurements when Figma's beta API throws", async () => {
    const page = tree({
      id: "0:1",
      type: "PAGE",
      children: [{ id: "8:1" }],
    });
    const [layer] = page.children ?? [];

    Object.defineProperty(layer, "animations", {
      get: () => {
        throw new Error("Motion is not available here");
      },
    });
    page.getMeasurements = () => {
      throw new Error("Only in Dev Mode");
    };
    installFigma(page);
    Object.assign(figma, { motion: {} });

    const answer = await plugin.run("snapshot", { node: "8:1" });

    expect(answer).not.toHaveProperty("measurements");
    expect((answer as Shot).root).not.toHaveProperty("motion");
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

    const { root } = (await plugin.run("snapshot", {
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

    const { root } = (await plugin.run("snapshot", { node: "5:1" })) as Shot;

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
            (await plugin.run("snapshot", {
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
      ((await plugin.run("snapshot", { node: "7:1" })) as { root: { pathHash?: string } }).root.pathHash,
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

    const { root } = (await plugin.run("snapshot", { node: "7:9" })) as { root: { layoutGrids?: unknown[] } };

    expect(root.layoutGrids).toEqual([
      expect.objectContaining({
        pattern: "COLUMNS",
        count: 12,
      }),
    ]);
  });
});
