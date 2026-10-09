import { describe, expect, it } from "vitest";
import { designXml, readApply, type Snapshot, type SnapshotNode, unchangedAttributes } from "../src/index.ts";
import { fixture, nodesOf } from "./helpers/fixtures.ts";

describe("readApply", () => {
  it("lists every element with its parent, position and attributes, $ ones left out", () => {
    const { elements, errors } = readApply(
      [
        '<Frame id="2:1" gap="24px" $children="4">',
        '  <Text name="Title" font="700 32px/40px \'Inter\'">Hello <Span color="#F00">world</Span></Text>',
        '  <Rectangle width="10px" height="10px"/>',
        "</Frame>",
        '<Frame name="Card" width="300px" after="2:1"/>',
      ].join("\n"),
    );

    expect(errors).toEqual([]);
    expect(
      elements.map(({ tag, id, ref, parent, index, line }) => ({
        tag,
        id,
        ref,
        parent,
        index,
        line,
      })),
    ).toEqual([
      {
        tag: "Frame",
        id: "2:1",
        ref: "2:1",
        parent: null,
        index: 0,
        line: 1,
      },
      {
        tag: "Text",
        id: null,
        ref: "new:2",
        parent: "2:1",
        index: 0,
        line: 2,
      },
      {
        tag: "Rectangle",
        id: null,
        ref: "new:3",
        parent: "2:1",
        index: 1,
        line: 3,
      },
      {
        tag: "Frame",
        id: null,
        ref: "new:5",
        parent: null,
        index: 1,
        line: 5,
      },
    ]);
    expect(elements[0]?.attributes).toEqual({
      id: "2:1",
      gap: "24px",
    });
    expect(elements[1]?.content?.map((child) => (child.kind === "text" ? child.value : child.type))).toEqual([
      "Hello ",
      "Span",
    ]);
  });

  it("refuses unknown tags and attributes with their line and the closest known name, and keeps the rest", () => {
    const { elements, errors } = readApply(
      [
        '<Frame id="2:1" gapp="24px"/>',
        '<Widget id="2:2"/>',
        '<Frame id="2:3" gap="8px"><Span>x</Span></Frame>',
        '<Frame id="2:4" width="10px"/>',
      ].join("\n"),
    );

    expect(errors).toEqual([
      expect.objectContaining({
        line: 1,
        id: "2:1",
        attribute: "gapp",
        message: expect.stringMatching(/gapp/),
        hint: expect.stringMatching(/gap/),
      }),
      expect.objectContaining({
        line: 2,
        id: "2:2",
        message: expect.stringMatching(/Widget/),
      }),
      expect.objectContaining({
        line: 3,
        message: expect.stringMatching(/Span.*inside a Text/),
      }),
    ]);
    // An unknown attribute is left out; its element is still applied with the rest.
    expect(elements.map(({ id }) => id)).toEqual(["2:1", "2:3", "2:4"]);
    expect(elements[0]?.attributes).toEqual({ id: "2:1" });
  });

  it("refuses creating what comes in stage 4b, and keeps changing such layers by id", () => {
    const { elements, errors } = readApply('<Instance component="Button"/>\n<Image id="2:9" width="20px"/>');

    expect(errors).toEqual([
      expect.objectContaining({
        line: 1,
        message: expect.stringMatching(/Instance.*not available yet/),
      }),
    ]);
    expect(elements.map(({ id }) => id)).toEqual(["2:9"]);
  });

  it("returns a parse error with its line and column instead of throwing", () => {
    expect(readApply('<Frame id="2:1">\n<Text>hi</Frame>').errors).toEqual([
      expect.objectContaining({
        line: 2,
        column: 9,
        message: expect.stringMatching(/Expected <\/Text>/),
      }),
    ]);
  });
});

describe("the round trip: design_read's XML sent back changes nothing", () => {
  for (const name of [
    "positivus-services-row",
    "positivus-services-block",
    "positivus-hero",
    "positivus-landing-top",
  ]) {
    it(name, () => {
      const snapshot = fixture(name);
      const byId = new Map(nodesOf(snapshot).map((entry) => [entry.node.id, entry]));
      const { elements, errors } = readApply(designXml(snapshot).xml);
      const changed: string[] = [];

      expect(errors).toEqual([]);

      for (const element of elements) {
        const item = element.id === null ? undefined : byId.get(element.id);

        if (item === undefined) {
          changed.push(`${element.tag} without a layer`);
          continue;
        }

        const unchanged = unchangedAttributes(element, item, snapshot);

        for (const attribute of Object.keys(element.attributes)) {
          if (attribute !== "id" && !unchanged.attributes.has(attribute)) {
            changed.push(`${element.id} ${attribute}="${element.attributes[attribute]}"`);
          }
        }

        if (element.content !== undefined && !unchanged.text) {
          changed.push(`${element.id} text`);
        }
      }

      expect(changed).toEqual([]);
    });
  }
});

describe("unchangedAttributes", () => {
  it("keeps what really changed: a new gap, a renamed layer, new text", () => {
    const snapshot: Snapshot = fixture("positivus-services-row");
    const byId = new Map(nodesOf(snapshot).map((entry) => [entry.node.id, entry]));
    const { elements } = readApply(
      '<Frame id="2:4869" name="Services" gap="48px" padding="0 100px"/>\n<Text id="I2:4873;334:1481">Read more</Text>',
    );
    const [frame, text] = elements;
    const frameUnchanged = unchangedAttributes(
      frame as never,
      byId.get("2:4869") as { node: SnapshotNode; parent: SnapshotNode | null },
      snapshot,
    );
    const textUnchanged = unchangedAttributes(
      text as never,
      byId.get("I2:4873;334:1481") as { node: SnapshotNode; parent: SnapshotNode | null },
      snapshot,
    );

    expect([...frameUnchanged.attributes].sort()).toEqual(["id", "padding"]);
    expect(textUnchanged.text).toBe(false);
  });

  it("gives what the layer has now, and an image background whose file alone differs is unchanged", () => {
    const card: SnapshotNode = {
      id: "1:1",
      name: "Card",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      childCount: 1,
      fills: [
        {
          type: "IMAGE",
          imageHash: "abc",
          scaleMode: "FILL",
        },
      ],
      children: [
        {
          id: "1:2",
          name: "Box",
          type: "RECTANGLE",
          visible: true,
          x: 10,
          y: 10,
          width: 20,
          height: 20,
          childCount: 0,
        },
      ],
    };
    const snapshot: Snapshot = {
      root: card,
      styles: {},
      variables: {},
    };
    const { elements } = readApply(designXml(snapshot, { assetsPath: "/tmp/read/assets" }).xml);
    const now = unchangedAttributes(
      elements[0] as never,
      {
        node: card,
        parent: null,
      },
      snapshot,
    );

    expect(elements[0]?.attributes.background).toMatch(/^url\(\/tmp\/read\/assets\//);
    expect(now.attributes.has("background")).toBe(true);
    expect(now.current).toMatchObject({
      width: "200px",
      height: "100px",
    });
  });
});
