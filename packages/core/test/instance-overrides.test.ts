import { describe, expect, it } from "vitest";
import { designHints, designXml, type Snapshot, type SnapshotNode } from "../src/index.ts";

const layer = (fields: Partial<SnapshotNode> & { id: string }): SnapshotNode => ({
  name: fields.id,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const text = (id: string, overrides: string[]): SnapshotNode =>
  layer({
    id,
    type: "TEXT",
    overrides,
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
        },
      ],
    },
  });

const card = (): Snapshot => ({
  root: layer({
    id: "9:1",
    name: "Card",
    type: "INSTANCE",
    layoutMode: "VERTICAL",
    instance: {
      componentId: "5:0",
      componentName: "Card",
      properties: {},
    },
    overrides: ["width", "name", "strokes", "stokeTopWeight"],
    children: [
      layer({
        id: "I9:1;5:2",
        name: "Title row",
        overrides: ["characters", "styledTextSegments", "foo"],
      }),
      text("I9:1;5:3", ["fontSize", "visible", "fills"]),
      layer({
        id: "I9:1;5:4",
        name: "Untouched",
        overrides: ["name", "height", "annotations", "reactions", "componentProperties"],
      }),
    ],
  }),
  styles: {},
  variables: {},
});

const line = (xml: string, id: string) => xml.split("\n").find((row) => row.includes(`id="${id}"`)) ?? "";

describe("what an instance changed outside its component's properties", () => {
  it("writes the overridden fields on their layer in CSS words, in one order, each once, noise left out", () => {
    const { xml } = designXml(card());

    expect(line(xml, "9:1")).toContain('$override="border"');
    expect(line(xml, "I9:1;5:2")).toContain('$override="text, foo"');
    expect(line(xml, "I9:1;5:3")).toContain('$override="color, visibility, font"');
    expect(line(xml, "I9:1;5:4")).not.toContain("$override");
  });

  it("says once how many layers differ from their component, with examples", () => {
    const snapshot = card();

    expect(designHints(snapshot, designXml(snapshot))).toContainEqual(
      expect.stringMatching(
        /^3 layers inside instances differ from their component outside its properties \(.*Card.*\): give the component a property or a variant for them, or build them as one-offs\.$/,
      ),
    );
  });

  it("says nothing for what does not show (a layer's lock, its panel state, plugin data), and names style changes", () => {
    const { xml } = designXml({
      root: layer({
        id: "9:1",
        type: "INSTANCE",
        layoutMode: "VERTICAL",
        instance: {
          componentId: "5:0",
          componentName: "Card",
          properties: {},
        },
        children: [
          layer({
            id: "I9:1;1:1",
            overrides: ["expanded", "locked", "pluginData", "relativeTransform", "constraints", "layoutSizingHorizontal"],
          }),
          layer({
            id: "I9:1;1:2",
            overrides: ["fillStyleId", "effectStyleId", "minWidth"],
          }),
          text("I9:1;1:3", ["fillStyleId"]),
        ],
      }),
      styles: {},
      variables: {},
    });

    expect(line(xml, "I9:1;1:1")).not.toContain("$override");
    expect(line(xml, "I9:1;1:2")).toContain('$override="background, box-shadow, size"');
    expect(line(xml, "I9:1;1:3")).toContain('$override="color"');
  });
});
