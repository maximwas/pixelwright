import { describe, expect, it } from "vitest";
import {
  designHints,
  designXml,
  type InspectRaw,
  inspectView,
  interactionAttributes,
  type Snapshot,
  type SnapshotNode,
} from "../src/index.ts";

/** The small things two reviews left (stages 7 and 8), each pinned. */

const BLACK = {
  type: "SOLID",
  visible: true,
  color: {
    r: 0,
    g: 0,
    b: 0,
  },
};

const layer = (fields: Partial<SnapshotNode> & { id: string }): SnapshotNode => ({
  name: fields.id,
  type: "RECTANGLE",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const snapshotOf = (root: SnapshotNode, styles: Snapshot["styles"] = {}): Snapshot => ({
  root,
  styles,
  variables: {},
});

describe("hints", () => {
  it("say its children for one frame", () => {
    const hints = designHints(
      snapshotOf(
        layer({
          id: "1:1",
          type: "FRAME",
          children: [
            layer({
              id: "1:2",
              fills: [BLACK],
            }),
            layer({
              id: "1:3",
              x: 20,
              fills: [BLACK],
            }),
          ],
        }),
      ),
    );

    expect(hints.join("\n")).toMatch(/A frame has no auto layout, so its children/);
  });

  it("name --White-2 only where the XML uses it, not for --White-20", () => {
    const white = (duplicate?: number) => ({
      name: "White",
      type: "PAINT",
      remote: true,
      paints: [BLACK],
      ...(duplicate === undefined ? {} : { duplicate }),
    });
    const hints = designHints(
      snapshotOf(
        layer({
          id: "1:1",
          type: "FRAME",
          children: [
            layer({
              id: "1:2",
              fills: [BLACK],
              fillStyleId: "S:20",
            }),
          ],
        }),
        {
          "S:2": white(2),
          "S:20": white(20),
        },
      ),
    );

    expect(hints.join("\n")).not.toMatch(/--White-2 is/);
  });

  it("say of one layer that overflows that it overflows, in the singular", () => {
    const hints = designHints(
      snapshotOf(
        layer({
          id: "1:1",
          type: "FRAME",
          layoutMode: "VERTICAL",
          width: 100,
          height: 300,
          children: [
            layer({
              id: "1:2",
              type: "FRAME",
              width: 200,
              height: 20,
            }),
          ],
        }),
      ),
    );

    expect(hints).toContainEqual(
      expect.stringMatching(
        /^A layer is wider or taller than the room its auto layout parent gives it, so it overflows the parent in Figma too \(.*\): decide whether the build wraps, clips or lets it out\.$/,
      ),
    );
  });

  it("leave a turned layer's overflow alone: its box is not its width", () => {
    const hints = designHints(
      snapshotOf(
        layer({
          id: "1:1",
          type: "FRAME",
          layoutMode: "VERTICAL",
          width: 100,
          height: 300,
          children: [
            layer({
              id: "1:2",
              type: "LINE",
              width: 200,
              height: 0,
              rotation: -90,
            }),
          ],
        }),
      ),
    );

    expect(hints.join("\n")).not.toMatch(/wider or taller/);
  });
});

describe("CSS", () => {
  it("gives a progressive blur's end the radius filter has, rounded alike", () => {
    const { xml } = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          effects: [
            {
              type: "LAYER_BLUR",
              visible: true,
              radius: 5,
              blurType: "PROGRESSIVE",
              startRadius: 1,
            },
          ],
        }),
      ),
    );

    expect(xml).toContain('filter="blur(3px)"');
    expect(xml).toContain("blur: progressive from 1px at 50% 0% to 3px at 50% 100%");
  });

  it("writes no stroke-align for a line that draws no stroke", () => {
    const { xml } = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          type: "FRAME",
          children: [
            layer({
              id: "1:2",
              type: "LINE",
              height: 0,
              strokeAlign: "CENTER",
            }),
          ],
        }),
      ),
    );

    expect(xml).not.toContain("stroke-align");
  });
});

describe("interactions", () => {
  it("name an unknown trigger without doubling on-", () => {
    expect(
      interactionAttributes([
        {
          trigger: { type: "ON_SCROLL" },
          actions: [{ type: "BACK" }],
        },
      ]).map(([name]) => name),
    ).toEqual(["$on-scroll"]);
  });
});

describe("inspect", () => {
  it("ends a line at a paragraph separator too", () => {
    const raw = {
      origin: null,
      missing: [],
      layers: [
        {
          ...layer({
            id: "1:1",
            type: "TEXT",
          }),
          text: {
            characters: "One Two",
            textAutoResize: "HEIGHT",
            textAlignHorizontal: "LEFT",
            textAlignVertical: "TOP",
            segments: [],
          },
          parent: null,
          box: {
            x: 0,
            y: 0,
            width: 100,
            height: 40,
          },
          paintedBox: null,
          parentBox: null,
          parentPadding: null,
        },
      ],
    } as unknown as InspectRaw;

    expect(inspectView(raw).layers[0]?.text?.lines).toEqual([
      {
        text: "One",
        break: "paragraph",
      },
      {
        text: "Two",
        break: null,
      },
    ]);
  });
});

describe("same-named text styles", () => {
  it("are named in textStyle as their tokens number them: the second h1 is h1-2", () => {
    const h1 = (duplicate?: number) => ({
      name: "h1",
      type: "TEXT",
      remote: true,
      fontName: {
        family: "Inter",
        style: "Bold",
      },
      fontSize: duplicate === undefined ? 32 : 40,
      lineHeight: { unit: "AUTO" as const },
      ...(duplicate === undefined ? {} : { duplicate }),
    });
    const read = designXml(
      snapshotOf(
        layer({
          id: "1:1",
          type: "TEXT",
          text: {
            characters: "Hi",
            textAutoResize: "WIDTH_AND_HEIGHT",
            textAlignHorizontal: "LEFT",
            textAlignVertical: "TOP",
            segments: [
              {
                characters: "Hi",
                start: 0,
                end: 2,
                fontName: {
                  family: "Inter",
                  style: "Bold",
                },
                fontSize: 40,
                fontWeight: 700,
                textDecoration: "NONE",
                textCase: "ORIGINAL",
                lineHeight: { unit: "AUTO" },
                letterSpacing: {
                  unit: "PIXELS",
                  value: 0,
                },
                fills: [BLACK],
                fillStyleId: "",
                textStyleId: "S:2",
              },
            ],
          },
        }),
        {
          "S:1": h1(),
          "S:2": h1(2),
        },
      ),
    );

    expect(read.xml).toContain('textStyle="h1-2"');
    expect(Object.keys(read.textStyles)).toEqual(["h1-2"]);
  });
});
