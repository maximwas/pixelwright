import { describe, expect, it } from "vitest";
import { designHints, designXml, readApply, type SnapshotNode, type TextSegment } from "../src/index.ts";

/** What a real Figma → Framer build needed from a read and had to guess (stage 7). */

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

const segment = (characters: string, fields: Partial<TextSegment> = {}): TextSegment => ({
  characters,
  start: 0,
  end: characters.length,
  fontName: {
    family: "Inter",
    style: "Regular",
  },
  fontSize: 16,
  fontWeight: 400,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
  lineHeight: {
    unit: "PIXELS",
    value: 19,
  },
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

const text = (id: string, characters: string, fields: Partial<SnapshotNode> = {}, segmentFields = {}) =>
  layer({
    id,
    type: "TEXT",
    name: characters,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "HUG",
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [segment(characters, segmentFields)],
    },
    ...fields,
  });

const read = (root: SnapshotNode) => {
  const snapshot = {
    root,
    styles: {},
    variables: {},
  };

  return {
    xml: designXml(snapshot).xml,
    hints: designHints(snapshot),
  };
};

const line = (xml: string, id: string) => xml.split("\n").find((row) => row.includes(`id="${id}"`)) ?? "";

describe("effects in full", () => {
  it("writes a progressive blur's start and end next to the blur CSS can show", () => {
    const { xml } = read(
      box([
        layer({
          id: "1:2",
          effects: [
            {
              type: "LAYER_BLUR",
              visible: true,
              radius: 16,
              blurType: "PROGRESSIVE",
              startRadius: 0,
              startOffset: {
                x: 0.5,
                y: 0,
              },
              endOffset: {
                x: 0.5,
                y: 1,
              },
            },
          ],
        }),
      ]),
    );

    expect(line(xml, "1:2")).toContain('filter="blur(8px)"');
    expect(line(xml, "1:2")).toContain("blur: progressive from 0px at 50% 0% to 8px at 50% 100%");
  });
});

describe("how strokes paint", () => {
  it("says a centred stroke paints half outside the box; an inside one says nothing", () => {
    const stroke = (id: string, strokeAlign: string) =>
      layer({
        id,
        strokes: [
          {
            type: "SOLID",
            color: DARK,
          },
        ],
        strokeWeight: 1,
        strokeAlign,
      });
    const { xml } = read(box([stroke("1:2", "CENTER"), stroke("1:3", "INSIDE")]));

    expect(line(xml, "1:2")).toContain("stroke-align: center (half of it paints outside the box)");
    expect(line(xml, "1:3")).not.toContain("stroke-align");
  });

  it("says it of a Line too: Figma paints a Line at y=100 over 99.5 to 100.5, a border-top from 100", () => {
    const { xml } = read(
      box([
        layer({
          id: "1:4",
          type: "LINE",
          y: 100,
          width: 100,
          height: 0,
          strokes: [
            {
              type: "SOLID",
              color: DARK,
            },
          ],
          strokeWeight: 1,
          strokeAlign: "CENTER",
        }),
      ]),
    );

    expect(line(xml, "1:4")).toContain("stroke-align: center (half of it paints outside the box)");
  });
});

describe("text", () => {
  it("shows a Shift+Enter break as &#8232; and reads it back as the same break", () => {
    const { xml } = read(box([text("1:2", "Behind Your")]));

    expect(line(xml, "1:2")).toContain("Behind&#8232;Your");

    const element = readApply(line(xml, "1:2").trim()).elements[0];
    const texts = (element?.content ?? []).flatMap((child) => (child.kind === "text" ? [child.value] : []));

    expect(texts.join("")).toBe("Behind Your");
  });

  it("hints that line-height normal is Figma's Auto, and where Shift+Enter breaks are", () => {
    const { hints } = read(
      box([text("1:2", "Auto line", {}, { lineHeight: { unit: "AUTO" } }), text("1:3", "Behind Your")]),
    );

    expect(hints).toContainEqual(expect.stringMatching(/normal.*Auto.*1:2/s));
    expect(hints).toContainEqual(expect.stringMatching(/&#8232;.*Shift\+Enter.*1:3/s));
  });

  it("hints when a layer is wider than the room its parent gives it", () => {
    const { hints } = read(
      box(
        [
          text(
            "1:2",
            "A long line of text",
            {
              width: 306,
              layoutSizingHorizontal: "FIXED",
            },
            {},
          ),
        ],
        {
          width: 297,
          layoutMode: "VERTICAL",
          paddingLeft: 0,
          paddingRight: 0,
        },
      ),
    );

    expect(hints).toContainEqual(expect.stringMatching(/wider.*1:2.*306px.*297px/s));
  });
});

describe("prototype interactions", () => {
  const hover = {
    trigger: { type: "ON_HOVER" },
    actions: [
      {
        type: "NODE",
        destinationId: "5:2",
        destinationName: "Type=Hover",
        navigation: "CHANGE_TO",
        transition: {
          type: "SMART_ANIMATE",
          duration: 0.3,
          easing: { type: "EASE_OUT" },
        },
      },
    ],
  };

  it("writes each trigger as a read-only attribute: what happens, then how it moves", () => {
    const { xml } = read(
      box([
        layer({
          id: "1:2",
          reactions: [
            hover,
            {
              trigger: {
                type: "AFTER_TIMEOUT",
                timeout: 0.8,
              },
              actions: [
                {
                  type: "NODE",
                  destinationId: "7:1",
                  destinationName: "Step 2",
                  navigation: "NAVIGATE",
                  transition: {
                    type: "MOVE_IN",
                    direction: "LEFT",
                    duration: 0.2,
                    easing: {
                      type: "CUSTOM_CUBIC_BEZIER",
                      easingFunctionCubicBezier: {
                        x1: 0.4,
                        y1: 0,
                        x2: 0.2,
                        y2: 1,
                      },
                    },
                  },
                },
              ],
            },
            {
              trigger: { type: "ON_CLICK" },
              actions: [
                {
                  type: "NODE",
                  destinationId: "8:1",
                  destinationName: "Menu",
                  navigation: "OVERLAY",
                  transition: {
                    type: "DISSOLVE",
                    duration: 0.25,
                    easing: { type: "GENTLE" },
                  },
                },
              ],
            },
          ],
        }),
      ]),
    );

    expect(line(xml, "1:2")).toContain('$on-hover="change to Type=Hover; smart animate 300ms ease-out"');
    expect(line(xml, "1:2")).toContain(
      '$after-timeout="after 800ms; go to Step 2; move in left 200ms cubic-bezier(0.4, 0, 0.2, 1)"',
    );
    expect(line(xml, "1:2")).toContain('$on-click="open overlay Menu; dissolve 250ms spring gentle"');
  });

  it("leaves a link to its href, and design_apply leaves the interactions alone", () => {
    const { xml } = read(
      box([
        layer({
          id: "1:2",
          href: "https://example.com",
          reactions: [
            {
              trigger: { type: "ON_CLICK" },
              actions: [
                {
                  type: "URL",
                  url: "https://example.com",
                },
              ],
            },
            hover,
          ],
        }),
      ]),
    );

    expect(line(xml, "1:2")).not.toContain("$on-click");
    expect(readApply(line(xml, "1:2").trim()).elements[0]?.attributes).not.toHaveProperty("$on-hover");
  });
});
