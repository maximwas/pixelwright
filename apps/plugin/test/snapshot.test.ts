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
      css: true,
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
      css: true,
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
