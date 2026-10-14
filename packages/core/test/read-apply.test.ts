import { describe, expect, it } from "vitest";
import {
  changeOf,
  designXml,
  fitPlan,
  readApply,
  type Snapshot,
  type SnapshotNode,
  type TextSegment,
  unchangedAttributes,
} from "../src/index.ts";
import { fixture, nodesOf } from "./helpers/fixtures.ts";
import { oddTextSnapshot } from "./helpers/odd-text.ts";

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

  it("creates instances, components, sets, images, icons and slots, and refuses what they lack", () => {
    const { elements, errors } = readApply(
      [
        '<Instance component="Button" variant="Size=Large"/>',
        "<Instance/>",
        '<Image src="assets/photo.png" width="20px"/>',
        "<Icon/>",
        '<ComponentSet name="Badge"><Component variant="Tone=Dark"><Text prop="Label">New</Text></Component></ComponentSet>',
        '<Frame><Text prop="Label" visibleProp="Shown">x</Text></Frame>',
        "<Group/>",
        '<Image id="2:9" width="20px"/>',
      ].join("\n"),
    );

    expect(errors.map(({ line, attribute, message }) => [line, attribute, message])).toEqual([
      [2, undefined, expect.stringMatching(/component/)],
      [4, undefined, expect.stringMatching(/src/)],
      [6, "prop", expect.stringMatching(/Component/)],
      [6, "visibleProp", expect.stringMatching(/Component/)],
      [7, undefined, expect.stringMatching(/grouping/)],
    ]);
    expect(elements.map(({ tag, id }) => [tag, id])).toEqual([
      ["Instance", null],
      ["Image", null],
      ["ComponentSet", null],
      ["Component", null],
      ["Text", null],
      ["Frame", null],
      ["Text", null],
      ["Image", "2:9"],
    ]);
    expect(elements[4]?.attributes.prop).toBe("Label");
  });

  it("reads the ids inside a copy as the source's layers, each copy on its own", () => {
    const copy = (title: string) =>
      `<Frame copyOf="2:4870" name="Card ${title}"><Frame id="2:4871"><Text id="I2:4872;330:292">${title}</Text></Frame></Frame>`;
    const { elements, errors } = readApply(`${copy("One")}\n${copy("Two")}\n<Frame copyOf="2:4870" id="2:1"/>`);

    expect(errors).toEqual([
      expect.objectContaining({
        line: 3,
        message: expect.stringMatching(/copy is a new layer/),
      }),
    ]);
    expect(elements.map(({ id, source, attributes }) => [id, source ?? null, attributes.copyOf ?? null])).toEqual([
      [null, null, "2:4870"],
      [null, "2:4871", null],
      [null, "I2:4872;330:292", null],
      [null, null, "2:4870"],
      [null, "2:4871", null],
      [null, "I2:4872;330:292", null],
    ]);
    expect(new Set(elements.map(({ ref }) => ref)).size).toBe(6);
  });

  it("gives every element inside a copy or a new instance that scope's ref, however deep, the ids there being its layers", () => {
    const { elements, errors } = readApply(
      [
        '<Frame copyOf="1:1"><Frame id="1:5"><Text id="1:2">Copied</Text></Frame></Frame>',
        '<Instance component="Heading"><Frame id="I2:1;3:4"><Text id="I2:1;3:5">Our work</Text></Frame></Instance>',
      ].join("\n"),
    );
    const [copy, frame, text, instance, label, labelText] = elements;

    expect(errors).toEqual([]);
    expect([frame, text].map((element) => [element?.source, element?.copy])).toEqual([
      ["1:5", copy?.ref],
      ["1:2", copy?.ref],
    ]);
    expect([label, labelText].map((element) => [element?.id, element?.source, element?.copy])).toEqual([
      [null, "I2:1;3:4", instance?.ref],
      [null, "I2:1;3:5", instance?.ref],
    ]);
  });

  it("refuses an id given twice and an id that is no Figma id, and skips their elements' new children", () => {
    const { elements, errors } = readApply(
      '<Frame id="2:4870" name="Card"/>\n<Frame id="2:4870" name="Copy"><Frame name="Badge"/></Frame>\n<Frame id="hero-title"/>',
    );

    expect(elements.map(({ ref }) => ref)).toEqual(["2:4870"]);
    expect(errors.map(({ line, message }) => [line, message])).toEqual([
      [2, expect.stringMatching(/given twice.*a new layer has no id/)],
      [2, expect.stringMatching(/not created/)],
      [3, expect.stringMatching(/not a Figma layer id/)],
    ]);
  });

  it("refuses what a tag cannot take, naming what to write instead", () => {
    const { elements, errors } = readApply(
      '<Text id="1:1" background="#000" display="flex" gap="4px" color="#FFF" box-shadow="0 1px 2px 0 #000">x</Text>\n<Rectangle id="1:2" padding="4px" font="400 12px/normal \'Inter\'"/>\n<Text id="1:3" display="none"/>',
    );

    expect(errors.map(({ line, attribute }) => [line, attribute])).toEqual([
      [1, "background"],
      [1, "display"],
      [1, "gap"],
      [1, "box-shadow"],
      [2, "padding"],
      [2, "font"],
    ]);
    expect(errors[0]?.hint).toMatch(/color/);
    expect(errors[3]?.hint).toMatch(/text-shadow/);
    expect(elements.map(({ attributes }) => Object.keys(attributes))).toEqual([
      ["id", "color"],
      ["id"],
      ["id", "display"],
    ]);
  });

  it("leaves a text as it is when its element has no content, so a partial edit never empties it", () => {
    const [empty, closed, written] = readApply(
      '<Text id="1:2" color="#F00"/>\n<Text id="1:3"></Text>\n<Text id="1:4">Hi</Text>',
    ).elements;

    expect(empty).not.toHaveProperty("content");
    expect(closed).not.toHaveProperty("content");
    expect(written?.content).toHaveLength(1);
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
  for (const name of ["orbit-plans", "orbit-pricing", "orbit-customers", "orbit-desktop-top"]) {
    it(name, () => {
      const snapshot = fixture(name);

      expect(changesOf(snapshot, designXml(snapshot).xml)).toEqual([]);
    });
  }

  it("with quotes, line breaks, U+2028 and texts of odd spaces", () => {
    const snapshot = oddTextSnapshot();

    expect(changesOf(snapshot, designXml(snapshot).xml)).toEqual([]);
  });

  it("with instances a Code Connect template renders written without their children", () => {
    const snapshot = fixture("orbit-plans");
    const xml = designXml(snapshot, {
      connected: new Map([
        ["I54:244;54:211", "Button"],
        ["54:268", "PlanCard"],
      ]),
    }).xml;

    expect(xml).toContain('$code="Button"');
    expect(xml).toContain('$code="PlanCard"');
    expect(changesOf(snapshot, xml)).toEqual([]);
  });

  it("with the properties a designer pinned in annotations", () => {
    const plans = fixture("orbit-plans");
    const snapshot: Snapshot = {
      ...plans,
      root: {
        ...plans.root,
        annotations: [
          {
            label: "Three plans side by side",
            pins: ["itemSpacing", "padding"],
          },
          { pins: ["width"] },
        ],
      },
    };
    const xml = designXml(snapshot).xml;

    expect(xml).toContain('$pins="gap, padding, width"');
    expect(changesOf(snapshot, xml)).toEqual([]);
  });

  it("with what an instance overrides", () => {
    const plans = fixture("orbit-plans");
    const overridden = (node: SnapshotNode): SnapshotNode => ({
      ...node,
      ...(node.id === "I54:244;54:217" ? { overrides: ["characters", "styledTextSegments"] } : {}),
      ...(node.children === undefined ? {} : { children: node.children.map(overridden) }),
    });
    const snapshot: Snapshot = {
      ...plans,
      root: overridden(plans.root),
    };
    const xml = designXml(snapshot).xml;

    expect(xml).toContain('$override="text"');
    expect(changesOf(snapshot, xml)).toEqual([]);
  });

  it("with a grid style on the root", () => {
    const plans = fixture("orbit-plans");
    const snapshot: Snapshot = {
      ...plans,
      root: {
        ...plans.root,
        gridStyleId: "S:grid",
      },
      styles: {
        ...plans.styles,
        "S:grid": {
          name: "Desktop 12",
          type: "GRID",
          remote: false,
        },
      },
    };
    const xml = designXml(snapshot).xml;

    expect(xml).toContain('$grid-style="Desktop 12"');
    expect(changesOf(snapshot, xml)).toEqual([]);
  });

  it("with the read marked ready for dev", () => {
    const snapshot: Snapshot = {
      ...fixture("orbit-plans"),
      devStatus: "ready",
    };
    const xml = designXml(snapshot).xml;

    expect(xml.split("\n")[0]).toContain('$dev="ready for dev"');
    expect(xml.split("\n").slice(1).join("\n")).not.toContain("$dev");
    expect(changesOf(snapshot, xml)).toEqual([]);
  });

  it("with Figma Motion on a layer", () => {
    const plans = fixture("orbit-plans");
    const [first, ...rest] = plans.root.children ?? [];
    const snapshot: Snapshot = {
      ...plans,
      root: {
        ...plans.root,
        children: [
          {
            ...(first as SnapshotNode),
            motion: {
              timeline: 1.2,
              styles: [],
              tracks: [
                {
                  field: "OPACITY",
                  operation: "SET",
                  base: {
                    type: "FLOAT",
                    value: 1,
                  },
                  keyframes: [
                    {
                      t: 0,
                      value: {
                        type: "FLOAT",
                        value: 0,
                      },
                      easing: { type: "LINEAR" },
                    },
                    {
                      t: 0.6,
                      value: {
                        type: "FLOAT",
                        value: 1,
                      },
                      easing: { type: "LINEAR" },
                    },
                  ],
                },
              ],
            },
          },
          ...rest,
        ],
      },
    };
    const xml = designXml(snapshot).xml;

    expect(xml).toContain('$motion="opacity 0→1; 0–0.6s linear"');
    expect(changesOf(snapshot, xml)).toEqual([]);
  });
});

/** What sending this XML back would change in the snapshot's layers: an element's attributes and text, by id. */
function changesOf(snapshot: Snapshot, xml: string): string[] {
  const byId = new Map(nodesOf(snapshot).map((entry) => [entry.node.id, entry]));
  const { elements, errors } = readApply(xml);
  const changed: string[] = errors.map(({ message }) => message);

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

  return changed;
}

/** A text layer of these characters, one run of Inter 16. */
function textLayer(id: string, characters: string): SnapshotNode {
  const segment: TextSegment = {
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
    lineHeight: { unit: "AUTO" },
    letterSpacing: {
      unit: "PIXELS",
      value: 0,
    },
    fills: [],
    fillStyleId: "",
    textStyleId: "",
  };

  return {
    id,
    name: characters.slice(0, 10),
    type: "TEXT",
    visible: true,
    x: 0,
    y: 0,
    width: 300,
    height: 2000,
    childCount: 0,
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "HUG",
    text: {
      characters,
      textAutoResize: "HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [segment],
    },
  };
}

describe("the round trip of a read cut to fit maxChars", () => {
  it("leaves a text design_read shortened as it is, never writing the shortened one", () => {
    const snapshot: Snapshot = {
      root: {
        id: "1:1",
        name: "Article",
        type: "FRAME",
        visible: true,
        x: 0,
        y: 0,
        width: 300,
        height: 2000,
        childCount: 1,
        layoutMode: "VERTICAL",
        children: [textLayer("1:2", "Lorem ipsum dolor sit amet. ".repeat(200))],
      },
      styles: {},
      variables: {},
    };
    const xml = designXml(snapshot, fitPlan(snapshot, 2_000)).xml;
    const { elements } = readApply(xml);
    const text = elements.find(({ id }) => id === "1:2");

    expect(xml).toContain('$truncated="true"');
    expect(text).toBeDefined();
    expect(text).not.toHaveProperty("content");
    expect(
      changeOf(
        text as never,
        unchangedAttributes(
          text as never,
          {
            node: snapshot.root.children?.[0] as SnapshotNode,
            parent: snapshot.root,
          },
          snapshot,
        ),
      ).change,
    ).not.toHaveProperty("text");
  });
});

describe("unchangedAttributes", () => {
  it("keeps what really changed: a new gap, a renamed layer, new text", () => {
    const snapshot: Snapshot = fixture("orbit-plans");
    const byId = new Map(nodesOf(snapshot).map((entry) => [entry.node.id, entry]));
    const { elements } = readApply(
      '<Frame id="54:243" name="Tiers" gap="48px" width="1200px"/>\n<Text id="I54:244;54:207">For hobby projects.</Text>',
    );
    const [frame, text] = elements;
    const frameUnchanged = unchangedAttributes(
      frame as never,
      byId.get("54:243") as { node: SnapshotNode; parent: SnapshotNode | null },
      snapshot,
    );
    const textUnchanged = unchangedAttributes(
      text as never,
      byId.get("I54:244;54:207") as { node: SnapshotNode; parent: SnapshotNode | null },
      snapshot,
    );

    expect([...frameUnchanged.attributes].sort()).toEqual(["id", "width"]);
    expect(textUnchanged.text).toBe(false);
  });

  it("reads a hidden layer whole, so showing it again keeps the layout it has", () => {
    const panel: SnapshotNode = {
      id: "5:1",
      name: "Panel",
      type: "FRAME",
      visible: false,
      x: 0,
      y: 0,
      width: 200,
      height: 300,
      childCount: 0,
      layoutMode: "VERTICAL",
      itemSpacing: 8,
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "FIXED",
    };
    const [element] = readApply('<Frame id="5:1" display="flex"/>').elements;
    const now = unchangedAttributes(
      element as never,
      {
        node: panel,
        parent: null,
      },
      {
        styles: {},
        variables: {},
      },
    );

    expect(now).toMatchObject({
      visible: false,
      current: { "flex-direction": "column" },
    });
    expect(changeOf(element as never, now).change.props).toMatchObject({
      visible: true,
      layoutMode: "VERTICAL",
    });
  });

  it("compares a nested element with its layer as its parent holds it, so a hugging layer's own size is a change", () => {
    const button: SnapshotNode = {
      id: "6:2",
      name: "Button",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      childCount: 0,
      layoutMode: "HORIZONTAL",
      layoutSizingHorizontal: "HUG",
      layoutSizingVertical: "HUG",
    };
    const row: SnapshotNode = {
      id: "6:1",
      name: "Row",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 400,
      height: 40,
      childCount: 1,
      layoutMode: "HORIZONTAL",
    };
    const tokens = {
      styles: {},
      variables: {},
    };
    const nested = readApply('<Frame id="6:1"><Frame id="6:2" width="120px"/></Frame>').elements[1];
    const alone = readApply('<Frame id="6:2" width="120px"/>').elements[0];

    expect(
      unchangedAttributes(
        nested as never,
        {
          node: button,
          parent: row,
        },
        tokens,
      ).attributes.has("width"),
    ).toBe(false);
    expect(
      unchangedAttributes(
        alone as never,
        {
          node: button,
          parent: row,
        },
        tokens,
      ).attributes.has("width"),
    ).toBe(true);
  });

  it("writes an image background that reads back whatever its assets folder is called", () => {
    // A frame with a child: its image is a background, url() and all.
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

    for (const assetsPath of ["/tmp/My Project/assets", "/tmp/assets (old)", "/tmp/it's", '/tmp/say "hi"']) {
      const read = readApply(designXml(snapshot, { assetsPath }).xml);

      const change = changeOf(read.elements[0] as never);

      expect([...read.errors, ...change.errors], assetsPath).toEqual([]);
      expect(change.change.props.fills, assetsPath).toEqual([
        expect.objectContaining({
          kind: "image",
          src: expect.stringMatching(new RegExp(`^${assetsPath.replace(/[()]/g, "\\$&")}/`)),
        }),
      ]);
      // Sent back as it was read, it is no change.
      expect(
        unchangedAttributes(
          read.elements[0] as never,
          {
            node: card,
            parent: null,
          },
          snapshot,
        ).attributes.has("background"),
        assetsPath,
      ).toBe(true);
    }
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
