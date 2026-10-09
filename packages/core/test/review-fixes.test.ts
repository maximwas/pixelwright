import { describe, expect, it } from "vitest";
import {
  type CssContext,
  designXml,
  fitDesign,
  nodeCss,
  type Snapshot,
  type SnapshotNode,
  tokenName,
} from "../src/index.ts";

/** Regressions for the stage-2b final review: each test failed before its fix. */

const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
};

const layer = (fields: Partial<SnapshotNode> & { id: string }): SnapshotNode => ({
  name: fields.id,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const snapshotOf = (root: SnapshotNode, extra: Partial<Snapshot> = {}): Snapshot => ({
  root,
  styles: {},
  variables: {},
  ...extra,
});

const copy = (id: string, characters = "Copy") =>
  layer({
    id,
    type: "TEXT",
    name: "Copy",
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [],
    },
  });

const line = (xml: string, id: string) => xml.split("\n").find((row) => row.includes(`id="${id}"`)) ?? "";

describe("stage-2b review fixes", () => {
  it("cuts a flat tree too: the widest element keeps its first children and says how many it has", () => {
    const root = layer({
      id: "1:1",
      name: "Grid",
      children: Array.from({ length: 3_000 }, (_, index) =>
        layer({
          id: `2:${index}`,
          type: "RECTANGLE",
          name: "Cell",
        }),
      ),
    });
    const read = fitDesign(snapshotOf(root), 20_000);

    expect(read.xml.length).toBeLessThanOrEqual(20_000);
    expect(line(read.xml, "1:1")).toContain('$children="3000"');
    expect(read.truncated).toContain("1:1");
  });

  it("shortens one text too long for maxChars and marks it", () => {
    const read = fitDesign(
      snapshotOf(
        layer({
          id: "1:1",
          layoutMode: "VERTICAL",
          children: [copy("1:2", "word ".repeat(10_000))],
        }),
      ),
      5_000,
    );

    expect(read.xml.length).toBeLessThanOrEqual(5_000);
    expect(line(read.xml, "1:2")).toContain('$truncated="true"');
    expect(read.truncated).toContain("1:2");
  });

  it("never makes the read's root, or a section with text, one image because its bottom layer is a mask", () => {
    const mask = layer({
      id: "1:9",
      type: "RECTANGLE",
      isMask: true,
    });
    const root = layer({
      id: "1:1",
      name: "Landing",
      layoutMode: "VERTICAL",
      children: [
        mask,
        layer({
          id: "1:2",
          type: "SECTION",
          name: "Hero",
          children: [
            {
              ...mask,
              id: "1:3",
            },
            copy("1:4"),
          ],
        }),
      ],
    });
    const xml = designXml(snapshotOf(root)).xml;

    expect(line(xml, "1:1")).toContain("<Frame");
    expect(line(xml, "1:2")).toContain("<Section");
  });

  it("does not take a section with text for an SVG asset, and ignores PDF exports", () => {
    const xml = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          children: [
            layer({
              id: "1:2",
              name: "Pricing section",
              exportSettings: [{ format: "SVG" }],
              children: [copy("1:3")],
            }),
            layer({
              id: "1:4",
              type: "SECTION",
              name: "Print",
              exportSettings: [{ format: "PDF" }],
              children: [
                layer({
                  id: "1:5",
                  type: "RECTANGLE",
                }),
              ],
            }),
          ],
        }),
      ),
    ).xml;

    expect(line(xml, "1:2")).toContain("<Frame");
    expect(line(xml, "1:4")).toContain("<Section");
  });

  it("keeps a diagonal line's angle, and snaps only lines within half a degree of a right angle", () => {
    const lineAt = (rotation: number) =>
      new Map(
        nodeCss(
          layer({
            id: "1:2",
            type: "LINE",
            width: 40,
            height: 0,
            rotation,
            strokes: [
              {
                type: "SOLID",
                color: DARK,
              },
            ],
            strokeWeight: 1,
          }),
          layer({
            id: "1:1",
            layoutMode: "HORIZONTAL",
          }),
          context(),
        ).properties,
      );

    expect(lineAt(30).get("transform")).toBe("rotate(-30deg)");
    expect(lineAt(60).get("transform")).toBe("rotate(-60deg)");
    expect(lineAt(60).get("border-top")).toBe("1px solid #191A23");
    expect(lineAt(90.2).get("border-left")).toBe("1px solid #191A23");
    expect(lineAt(90.2).has("transform")).toBe(false);
  });

  it("keeps a bound color variable's paint opacity", () => {
    const css = new Map(
      nodeCss(
        layer({
          id: "1:1",
          fills: [
            {
              type: "SOLID",
              color: DARK,
              opacity: 0.5,
              boundVariables: {
                color: {
                  type: "VARIABLE_ALIAS",
                  id: "V:1",
                },
              },
            },
          ],
        }),
        null,
        context({
          variables: {
            "V:1": {
              name: "Dark",
              collection: "Brand",
              resolvedType: "COLOR",
              remote: false,
              value: DARK,
            },
          },
        }),
      ).properties,
    );

    expect(css.get("background")).toBe("color-mix(in srgb, var(--Dark) 50%, transparent)");
  });

  it("writes instance properties and notes so values with commas, equals signs and bars parse back", () => {
    const xml = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          type: "INSTANCE",
          name: "Button",
          layoutMode: "HORIZONTAL",
          instance: {
            componentId: "9:1",
            componentName: "Button",
            properties: {
              "Label#1:0": {
                type: "TEXT",
                value: "Save, then close=yes",
              },
              "Icon#1:1": {
                type: "BOOLEAN",
                value: true,
              },
            },
          },
          annotations: [
            {
              label: "Opens a | b",
              category: "Behavior",
            },
            { label: "Second" },
          ],
        }),
      ),
    ).xml;

    expect(xml).toContain('props="Label=Save\\, then close\\=yes, Icon=true"');
    expect(xml).toContain('note="Behavior: Opens a \\| b | Second"');
  });

  it("keeps letters of any script in token names, and never gives two names one token", () => {
    expect(tokenName("Темний")).toBe("--Темний");
    expect(tokenName("Основний/500")).toBe("--Основний-500");
    expect(tokenName("★")).toMatch(/^--token-[0-9a-z]+$/);
    expect(tokenName("★")).not.toBe(tokenName("☆"));
  });

  it("spaces a vertical wrap's items as rows and its lines as columns, and keeps a negative gap read-only", () => {
    const vertical = nodeCss(
      layer({
        id: "1:1",
        layoutMode: "VERTICAL",
        layoutWrap: "WRAP",
        itemSpacing: 10,
        counterAxisSpacing: 40,
        childCount: 3,
      }),
      null,
      context(),
    );
    const css = new Map(vertical.properties);

    expect([css.get("gap"), css.get("column-gap")]).toEqual(["10px", "40px"]);

    const stack = nodeCss(
      layer({
        id: "1:2",
        layoutMode: "HORIZONTAL",
        itemSpacing: -8,
        childCount: 3,
      }),
      null,
      context(),
    );

    expect(stack.properties.find(([property]) => property === "gap")).toBeUndefined();
    expect(stack.readOnly).toContainEqual(["gap", "-8px (the children overlap)"]);
  });

  it("leaves to the exported file what it already holds: an asset's opacity, blur and inner shadows", () => {
    const xml = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          layoutMode: "VERTICAL",
          children: [
            layer({
              id: "1:2",
              type: "RECTANGLE",
              name: "Photo",
              opacity: 0.5,
              fills: [
                {
                  type: "IMAGE",
                  imageHash: "a".repeat(40),
                },
              ],
              effects: [
                {
                  type: "INNER_SHADOW",
                  color: {
                    ...DARK,
                    a: 1,
                  },
                  offset: {
                    x: 0,
                    y: 2,
                  },
                  radius: 4,
                  spread: 0,
                },
                {
                  type: "DROP_SHADOW",
                  color: {
                    ...DARK,
                    a: 1,
                  },
                  offset: {
                    x: 0,
                    y: 4,
                  },
                  radius: 8,
                  spread: 0,
                },
                {
                  type: "LAYER_BLUR",
                  radius: 8,
                },
              ],
            }),
          ],
        }),
      ),
    ).xml;

    expect(line(xml, "1:2")).toContain('box-shadow="0 4px 8px 0 #191A23"');
    expect(line(xml, "1:2")).not.toContain("opacity=");
    expect(line(xml, "1:2")).not.toContain("filter=");
  });

  it("sizes an icon by the box it draws in, strokes outside its geometry included", () => {
    const xml = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          children: [
            copy("1:3"),
            layer({
              id: "1:2",
              type: "VECTOR",
              name: "Arrow",
              x: 10,
              y: 10,
              width: 20,
              height: 0,
              renderBounds: {
                x: 9,
                y: 8.5,
                width: 22,
                height: 3,
              },
            }),
          ],
        }),
      ),
    ).xml;

    expect(line(xml, "1:2")).toContain('position="absolute" left="9px" top="9px" width="22px" height="3px"');
  });

  it("keeps the styles of mixed runs in a text inside an instance, and the instance children's ids", () => {
    const run = {
      fontName: {
        family: "Inter",
        style: "Regular",
      },
      fontSize: 16,
      fontWeight: 400,
      textDecoration: "NONE",
      textCase: "ORIGINAL",
      lineHeight: { unit: "AUTO" },
      letterSpacing: {
        unit: "PIXELS",
        value: 0,
      },
      fills: [
        {
          type: "SOLID",
          color: DARK,
        },
      ],
      fillStyleId: "",
      textStyleId: "",
    };
    const xml = designXml(
      snapshotOf(
        layer({
          id: "2:10",
          type: "INSTANCE",
          name: "Notice",
          layoutMode: "VERTICAL",
          instance: {
            componentId: "9:2",
            componentName: "Notice",
            properties: {},
          },
          children: [
            layer({
              id: "I2:10;5:1",
              type: "TEXT",
              name: "Body",
              layoutSizingHorizontal: "HUG",
              layoutSizingVertical: "HUG",
              text: {
                characters: "Read the terms now",
                textAutoResize: "WIDTH_AND_HEIGHT",
                textAlignHorizontal: "LEFT",
                textAlignVertical: "TOP",
                segments: [
                  {
                    ...run,
                    characters: "Read the ",
                    start: 0,
                    end: 9,
                  },
                  {
                    ...run,
                    characters: "terms",
                    start: 9,
                    end: 14,
                    fontWeight: 700,
                    fontName: {
                      family: "Inter",
                      style: "Bold",
                    },
                    textDecoration: "UNDERLINE",
                  },
                  {
                    ...run,
                    characters: " now",
                    start: 14,
                    end: 18,
                  },
                ],
              },
            }),
          ],
        }),
      ),
    ).xml;

    expect(xml).toContain(
      `<Text id="I2:10;5:1" name="Body" font="400 16px/normal 'Inter'" color="#191A23">Read the <Span font="700 16px/normal 'Inter'" text-decoration="underline">terms</Span> now</Text>`,
    );
  });
});

function context(extra: Partial<CssContext> = {}): CssContext {
  return {
    styles: {},
    variables: {},
    tokens: new Map(),
    root: layer({ id: "0:0" }),
    ...extra,
  };
}
