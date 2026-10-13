import { describe, expect, it } from "vitest";
import { designXml, type SnapshotNode, type TextSegment } from "../src/index.ts";

/** Cases real files have and the Orbit fixtures do not, from the Plugin API's node, paint and effect types. */

const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
};

const layer = (fields: Partial<SnapshotNode> & { id: string }): SnapshotNode => ({
  name: fields.id,
  type: "RECTANGLE",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const box = (children: SnapshotNode[], fields: Partial<SnapshotNode> = {}) =>
  layer({
    id: "1:1",
    name: "Box",
    type: "FRAME",
    width: 400,
    height: 300,
    children,
    ...fields,
  });

const xmlOf = (root: SnapshotNode) =>
  designXml({
    root,
    styles: {},
    variables: {},
  }).xml;

const line = (xml: string, id: string) => xml.split("\n").find((row) => row.includes(`id="${id}"`)) ?? "";

const segment = (fields: Partial<TextSegment> = {}): TextSegment => ({
  characters: "Read more",
  start: 0,
  end: 9,
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
  ...fields,
});

const text = (fields: Partial<SnapshotNode> = {}, segments = [segment()]) =>
  layer({
    id: "1:2",
    type: "TEXT",
    name: "Read more",
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    text: {
      characters: segments.map((run) => run.characters).join(""),
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments,
    },
    ...fields,
  });

describe("assets beyond icons and photos", () => {
  it("gives a turned or mirrored asset its bounding box and no transform: the export is already turned", () => {
    const xml = xmlOf(
      box([
        layer({
          id: "1:2",
          type: "VECTOR",
          name: "Arrow",
          x: 50,
          y: 10,
          width: 40,
          height: 0,
          rotation: 90,
          bounds: {
            x: 50,
            y: 10,
            width: 4,
            height: 40,
          },
        }),
        // Text keeps the box a frame: a frame of vectors only would be one icon itself.
        layer({
          id: "1:3",
          type: "TEXT",
        }),
      ]),
    );

    expect(line(xml, "1:2")).toBe(
      '  <Icon id="1:2" name="Arrow" src="assets/arrow.svg" position="absolute" left="50px" top="10px" width="4px" height="40px"/>',
    );
  });

  it("keeps a drawing's blend mode on its icon, as Figma blends the exported logo with what is under it", () => {
    const xml = xmlOf(
      box([
        layer({
          id: "1:2",
          type: "INSTANCE",
          name: "Logo",
          width: 124,
          height: 48,
          blendMode: "LUMINOSITY",
          children: [
            layer({
              id: "I1:2;1:1",
              type: "VECTOR",
              name: "Mark",
            }),
          ],
        }),
        // Text keeps the box a frame: a frame of vectors only would be one icon itself.
        layer({
          id: "1:3",
          type: "TEXT",
        }),
      ]),
    );

    expect(line(xml, "1:2")).toMatch(
      /^ {2}<Icon id="1:2" name="Logo" src="assets\/logo.svg" .*\$css="mix-blend-mode: luminosity"\/>$/,
    );
  });

  it("renders a leaf painted with what CSS cannot draw (video, pattern, shader, noise, glass) as an image", () => {
    const xml = xmlOf(
      box([
        layer({
          id: "1:2",
          name: "Clip",
          fills: [{ type: "VIDEO" }],
        }),
        layer({
          id: "1:3",
          name: "Grain",
          fills: [
            {
              type: "SOLID",
              color: DARK,
            },
          ],
          effects: [{ type: "NOISE" }],
        }),
      ]),
    );

    expect(line(xml, "1:2")).toContain('<Image id="1:2" name="Clip" src="assets/clip.png"');
    expect(line(xml, "1:3")).toContain('<Image id="1:3" name="Grain" src="assets/grain.png"');
  });

  it("draws text on a path and transform groups as icons, and leaves slices out", () => {
    const xml = xmlOf(
      box([
        layer({
          id: "1:2",
          type: "TEXT_PATH",
          name: "Badge text",
        }),
        layer({
          id: "1:3",
          type: "TRANSFORM_GROUP",
          name: "Pattern",
          children: [
            layer({
              id: "1:4",
              type: "VECTOR",
            }),
          ],
        }),
        layer({
          id: "1:5",
          type: "SLICE",
          name: "Export area",
        }),
      ]),
    );

    expect(line(xml, "1:2")).toContain("<Icon");
    expect(line(xml, "1:3")).toContain("<Icon");
    expect(xml).not.toContain("1:5");
  });
});

describe("constraints of a layer placed in a frame without auto layout", () => {
  const placed = (constraints: { horizontal: string; vertical: string }) =>
    line(
      xmlOf(
        box([
          layer({
            id: "1:2",
            x: 280,
            y: 180,
            width: 100,
            height: 100,
            constraints,
          }),
        ]),
      ),
      "1:2",
    );

  it("pins to the right and bottom edges", () => {
    expect(
      placed({
        horizontal: "MAX",
        vertical: "MAX",
      }),
    ).toContain('position="absolute" right="20px" bottom="20px" width="100px" height="100px"');
  });

  it("stretches between both edges without a fixed size", () => {
    const row = placed({
      horizontal: "STRETCH",
      vertical: "MIN",
    });

    expect(row).toContain('position="absolute" left="280px" right="20px" top="180px" height="100px"');
    expect(row).not.toContain("width=");
  });

  it("keeps its offset from the centre, and scales in percents", () => {
    expect(
      placed({
        horizontal: "CENTER",
        vertical: "SCALE",
      }),
    ).toContain('position="absolute" left="calc(50% + 80px)" top="60%" width="100px" height="33.33%"');
  });
});

describe("auto layout and grid", () => {
  it("spaces children evenly or around them, and aligns wrapped lines", () => {
    const xml = xmlOf(
      box(
        [
          layer({
            id: "1:2",
          }),
          layer({
            id: "1:3",
          }),
        ],
        {
          layoutMode: "HORIZONTAL",
          layoutWrap: "WRAP",
          primaryAxisAlignItems: "SPACE_EVENLY",
          counterAxisAlignContent: "SPACE_BETWEEN",
          itemSpacing: 24,
        },
      ),
    );

    expect(line(xml, "1:1")).toContain(
      'display="flex" flex-wrap="wrap" width="400px" height="300px" justify-content="space-evenly" align-content="space-between"',
    );
    expect(line(xml, "1:1")).not.toContain("gap=");
  });

  it("writes the gap between wrapped lines when it differs from the gap, 0 included, as CSS reads gap for both", () => {
    const wrap = (itemSpacing: number, counterAxisSpacing: number, fields: Partial<SnapshotNode> = {}) =>
      line(
        xmlOf(
          box([layer({ id: "1:2" }), layer({ id: "1:3" })], {
            layoutMode: "HORIZONTAL",
            layoutWrap: "WRAP",
            itemSpacing,
            counterAxisSpacing,
            ...fields,
          }),
        ),
        "1:1",
      );

    expect(wrap(12, 0)).toContain('gap="12px" row-gap="0"');
    expect(wrap(12, 12)).toContain('gap="12px"');
    expect(wrap(12, 12)).not.toContain("row-gap");
    expect(wrap(12, 16, { primaryAxisAlignItems: "SPACE_BETWEEN" })).toContain('row-gap="16px"');
  });

  it("writes grid tracks and where each child sits", () => {
    const xml = xmlOf(
      box(
        [
          layer({
            id: "1:2",
            gridRowAnchorIndex: 0,
            gridColumnAnchorIndex: 1,
            gridRowSpan: 1,
            gridColumnSpan: 2,
            gridChildHorizontalAlign: "CENTER",
            gridChildVerticalAlign: "AUTO",
          }),
        ],
        {
          layoutMode: "GRID",
          gridColumnCount: 3,
          gridRowCount: 2,
          gridColumnSizes: [
            {
              type: "FLEX",
              value: 1,
            },
            {
              type: "FLEX",
              value: 1,
            },
            {
              type: "FIXED",
              value: 200,
            },
          ],
          gridRowSizes: [{ type: "HUG" }, { type: "HUG" }],
          gridColumnGap: 16,
          gridRowGap: 8,
        },
      ),
    );

    expect(line(xml, "1:1")).toContain(
      'display="grid" width="400px" height="300px" column-gap="16px" row-gap="8px" grid-template-columns="1fr 1fr 200px" grid-template-rows="auto auto"',
    );
    expect(line(xml, "1:2")).toContain('grid-row="1" grid-column="2 / span 2" justify-self="center"');
  });
});

describe("text beyond font and color", () => {
  it("links a text and a run of it to their URLs", () => {
    const xml = xmlOf(
      text({}, [
        segment({
          characters: "Read ",
          end: 5,
        }),
        segment({
          characters: "more",
          start: 5,
          end: 9,
          hyperlink: {
            type: "URL",
            value: "https://example.com/more",
          },
        }),
      ]),
    );

    expect(xml).toContain('Read <Span href="https://example.com/more">more</Span>');
  });

  it("writes wrapping, decoration details, one-line truncation and vertical alignment", () => {
    const xml = xmlOf(
      text(
        {
          layoutSizingHorizontal: "FIXED",
          layoutSizingVertical: "FIXED",
          text: {
            characters: "Read more",
            textAutoResize: "NONE",
            textAlignHorizontal: "LEFT",
            textAlignVertical: "CENTER",
            textTruncation: "ENDING",
            maxLines: 1,
            segments: [
              segment({
                textDecoration: "UNDERLINE",
                textDecorationStyle: "WAVY",
                textDecorationOffset: {
                  unit: "PIXELS",
                  value: 3,
                },
                textDecorationThickness: {
                  unit: "PIXELS",
                  value: 2,
                },
                textWrapStyle: "BALANCE",
              }),
            ],
          },
        },
        [],
      ),
    );

    expect(xml).toContain('text-decoration="underline wavy"');
    expect(xml).toContain('text-underline-offset="3px" text-decoration-thickness="2px"');
    expect(xml).toContain('text-wrap="balance"');
    expect(xml).toContain('overflow="hidden" text-overflow="ellipsis" white-space="nowrap"');
    expect(xml).toContain('$css="align-content: center"');
  });

  it("keeps what CSS has no table entry for yet as read-only: line clamp, lists, paragraph spacing", () => {
    const xml = xmlOf(
      text(
        {
          text: {
            characters: "One\nTwo",
            textAutoResize: "HEIGHT",
            textAlignHorizontal: "LEFT",
            textAlignVertical: "TOP",
            textTruncation: "ENDING",
            maxLines: 3,
            paragraphSpacing: 12,
            segments: [
              segment({
                characters: "One\nTwo",
                end: 7,
                listOptions: { type: "UNORDERED" },
              }),
            ],
          },
        },
        [],
      ),
    );

    expect(xml).toContain('$css="line-clamp: 3; list-style: disc; paragraph-spacing: 12px"');
  });
});

describe("what designers tell developers", () => {
  it("writes an instance's own properties, a component's description, notes and a prototype link", () => {
    const xml = xmlOf(
      box([
        layer({
          id: "1:2",
          type: "INSTANCE",
          name: "Button",
          layoutMode: "HORIZONTAL",
          instance: {
            componentId: "9:1",
            componentName: "Size=Large",
            setId: "9:0",
            setName: "Button",
            properties: {
              Size: {
                type: "VARIANT",
                value: "Large",
              },
              "Label#12:0": {
                type: "TEXT",
                value: "Sign up",
              },
              "Icon#12:1": {
                type: "BOOLEAN",
                value: false,
              },
            },
          },
          annotations: [
            {
              label: "Opens the signup modal",
              category: "Behavior",
            },
          ],
          href: "https://example.com/signup",
        }),
        layer({
          id: "1:3",
          type: "COMPONENT",
          name: "Card",
          layoutMode: "VERTICAL",
          description: "A product card.",
        }),
      ]),
    );

    expect(line(xml, "1:2")).toContain(
      'name="Button" component="Button" variant="Size=Large" props="Label=Sign up, Icon=false" note="Behavior: Opens the signup modal" href="https://example.com/signup"',
    );
    expect(line(xml, "1:3")).toContain('name="Card" description="A product card."');
  });
});

describe("export settings and masks that do not make an asset", () => {
  const copy = (id: string) =>
    layer({
      id,
      type: "TEXT",
      name: "Copy",
      text: {
        characters: "Copy",
        textAutoResize: "WIDTH_AND_HEIGHT",
        textAlignHorizontal: "LEFT",
        textAlignVertical: "TOP",
        segments: [],
      },
    });

  it("reads a page or section with a PNG export (a preview) as layers, but a text-free one as an image", () => {
    const png = [
      {
        format: "PNG",
        constraint: {
          type: "SCALE",
          value: 1,
        },
      },
    ];
    const xml = xmlOf(
      box(
        [
          layer({
            id: "1:2",
            type: "FRAME",
            name: "Section",
            exportSettings: png,
            children: [copy("1:3")],
          }),
          layer({
            id: "1:4",
            type: "GROUP",
            name: "Collage",
            exportSettings: png,
            children: [
              layer({
                id: "1:5",
                type: "RECTANGLE",
              }),
              layer({
                id: "1:6",
                type: "ELLIPSE",
              }),
            ],
          }),
        ],
        {
          exportSettings: png,
          name: "Home",
        },
      ),
    );

    expect(line(xml, "1:1")).toContain('<Frame id="1:1" name="Home"');
    expect(line(xml, "1:2")).toContain('<Frame id="1:2" name="Section"');
    expect(line(xml, "1:4")).toContain('<Image id="1:4" name="Collage"');
  });

  it("keeps a frame whose mask sits among other layers, and says what the mask clips", () => {
    const xml = xmlOf(
      box([
        copy("1:2"),
        layer({
          id: "1:3",
          type: "ELLIPSE",
          name: "Mask",
          isMask: true,
        }),
        layer({
          id: "1:4",
          type: "RECTANGLE",
          name: "Photo",
        }),
      ]),
    );

    expect(line(xml, "1:1")).toContain("<Frame");
    expect(line(xml, "1:3")).toContain('$css="mask: clips the layers above it"');
  });
});
