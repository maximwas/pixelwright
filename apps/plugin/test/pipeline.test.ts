import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** design_apply end to end: the server's applyDesign over the plugin on the fake Figma. */
function pipeline() {
  const client = pluginClient(plugin);

  return (xml: string, options: { parent?: string; dryRun?: boolean } = {}) =>
    applyDesign(client, {
      xml,
      dryRun: options.dryRun ?? false,
      ...(options.parent === undefined ? {} : { parent: options.parent }),
    });
}

/** A text as a snapshot reads it: one run in one font, black, left and top aligned, sizing itself. */
const text = (id: string, characters: string, family = "Inter", style = "Regular") => ({
  id,
  type: "TEXT",
  name: characters,
  characters,
  textAutoResize: "WIDTH_AND_HEIGHT",
  fontName: {
    family,
    style,
  },
  fontSize: 16,
  fontWeight: style === "Regular" ? 400 : 500,
  fillStyleId: "",
  textStyleId: "",
  hyperlink: null,
  textAlignHorizontal: "LEFT",
  textAlignVertical: "TOP",
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
      visible: true,
      opacity: 1,
      blendMode: "NORMAL",
      color: {
        r: 0,
        g: 0,
        b: 0,
      },
    },
  ],
});

/** A team library's Heading set: each variant holds a label box with a text. */
function heading(): FakeNode {
  const set = tree({
    id: "7:1",
    name: "Heading",
    type: "COMPONENT_SET",
    componentPropertyDefinitions: {
      "Property 1": {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default", "Green"],
      },
    },
    children: [
      {
        id: "7:2",
        name: "Property 1=Default",
        type: "COMPONENT",
        layoutMode: "VERTICAL",
        children: [
          {
            id: "3:4",
            name: "Label box",
            layoutMode: "HORIZONTAL",
            children: [text("3:5", "Title")],
          },
        ],
      },
      {
        id: "7:3",
        name: "Property 1=Green",
        type: "COMPONENT",
        layoutMode: "VERTICAL",
        children: [
          {
            id: "3:6",
            name: "Label box",
            layoutMode: "HORIZONTAL",
            children: [text("3:7", "Title")],
          },
        ],
      },
    ],
  });

  set.defaultVariant = set.children?.[0];

  return set;
}

/** A Button set (Default, Hover), each variant holding its label. */
function button(): FakeNode {
  const set = tree({
    id: "7:10",
    name: "Button",
    type: "COMPONENT_SET",
    componentPropertyDefinitions: {
      State: {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default", "Hover"],
      },
    },
    children: [
      {
        id: "7:11",
        name: "State=Default",
        type: "COMPONENT",
        layoutMode: "HORIZONTAL",
        children: [text("7:12", "Go")],
      },
      {
        id: "7:13",
        name: "State=Hover",
        type: "COMPONENT",
        layoutMode: "HORIZONTAL",
        children: [text("7:14", "Go")],
      },
    ],
  });

  set.defaultVariant = set.children?.[0];

  return set;
}

/** A Card component with a Title text property and a Button inside, as its instance 2:9 holds them. */
function card(buttons: FakeNode): { component: FakeNode; instance: Parameters<typeof tree>[0] } {
  const main = buttons.children?.[0] as FakeNode;
  const title = { componentPropertyReferences: { characters: "Title#8:9" } };
  const component = tree({
    id: "8:1",
    name: "Card",
    type: "COMPONENT",
    layoutMode: "VERTICAL",
    componentPropertyDefinitions: {
      "Title#8:9": {
        type: "TEXT",
        defaultValue: "Card title",
      },
    },
    children: [
      {
        ...text("8:3", "Card title"),
        ...title,
      },
      {
        id: "8:2",
        name: "Button",
        type: "INSTANCE",
        layoutMode: "HORIZONTAL",
        mainComponent: main,
        componentProperties: {
          State: {
            type: "VARIANT",
            value: "Default",
          },
        },
        children: [text("I8:2;7:12", "Go")],
      },
    ],
  });

  return {
    component,
    instance: {
      id: "2:9",
      name: "Card",
      type: "INSTANCE",
      layoutMode: "VERTICAL",
      mainComponent: component,
      componentProperties: {
        "Title#8:9": {
          type: "TEXT",
          value: "Card title",
        },
      },
      children: [
        {
          ...text("I2:9;8:3", "Card title"),
          ...title,
        },
        {
          id: "I2:9;8:2",
          name: "Button",
          type: "INSTANCE",
          layoutMode: "HORIZONTAL",
          mainComponent: main,
          componentProperties: {
            State: {
              type: "VARIANT",
              value: "Default",
            },
          },
          children: [text("I2:9;8:2;7:12", "Go")],
        },
      ],
    },
  };
}

let root: FakeNode;
let library: FakeNode;
let buttons: FakeNode;
let cards: FakeNode;
let fake: ReturnType<typeof installFigma>;
let apply: ReturnType<typeof pipeline>;
const all = (from: FakeNode): FakeNode[] => [from, ...(from.children ?? []).flatMap(all)];
const byId = (id: string) =>
  [...all(root), ...all(library), ...all(buttons), ...all(cards), ...fake.writes.created].find(
    (node) => node.id === id,
  );

beforeEach(() => {
  library = heading();
  buttons = button();

  const main = library.children?.[0] as FakeNode;
  const nested = card(buttons);

  cards = nested.component;

  root = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        layoutMode: "VERTICAL",
        children: [
          {
            id: "1:5",
            name: "Heading and link",
            layoutMode: "VERTICAL",
            children: [text("1:2", "Hello"), text("1:6", "Read more", "Space Grotesk", "Medium")],
          },
        ],
      },
      {
        id: "3:1",
        name: "Board",
        layoutMode: "NONE",
        children: [],
      },
      {
        id: "9:1",
        name: "Row",
        layoutMode: "HORIZONTAL",
        children: ["A", "B", "C"].map((name, index) => ({
          id: `9:${index + 2}`,
          type: "RECTANGLE",
          name,
        })),
      },
      {
        id: "2:1",
        name: "Heading",
        type: "INSTANCE",
        layoutMode: "VERTICAL",
        mainComponent: main,
        componentProperties: {
          "Property 1": {
            type: "VARIANT",
            value: "Default",
          },
        },
        children: [
          {
            id: "I2:1;3:4",
            name: "Label box",
            layoutMode: "HORIZONTAL",
            children: [text("I2:1;3:5", "Search engine")],
          },
        ],
      },
      {
        id: "5:1",
        name: "Area",
        type: "SECTION",
        absoluteBoundingBox: {
          x: 0,
          y: 200,
          width: 600,
          height: 400,
        },
        children: [],
      },
      nested.instance,
    ],
  });
  fake = installFigma(root, {
    components: [library, buttons, cards],
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
      {
        family: "Space Grotesk",
        style: "Medium",
      },
    ],
  });
  apply = pipeline();
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("design_apply end to end: copies and new instances", () => {
  it("writes a layer deep inside a copy, the source untouched", async () => {
    const result = await apply(
      '<Frame id="3:1"><Frame copyOf="1:1" name="Card 2"><Frame id="1:5"><Text id="1:2">Copied title</Text></Frame></Frame></Frame>',
    );
    const copy = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(copy?.children?.[0]?.children?.[0]?.characters).toBe("Copied title");
    expect(byId("1:2")?.characters).toBe("Hello");
  });

  it("names the layers it made, and lists a copy's layers it wrote as changed, by their ids in the copy", async () => {
    const result = await apply(
      '<Frame id="3:1"><Frame copyOf="1:1" name="Card 2"><Frame id="1:5"><Text id="1:2">Copied title</Text></Frame></Frame><Frame name="Spacer"/></Frame>',
    );
    const copy = byId(result.created[0]?.id ?? "");
    const title = copy?.children?.[0]?.children?.[0];

    expect(result.errors).toEqual([]);
    expect(result.created.map(({ name, tag }) => [name, tag])).toEqual([
      ["Card 2", "Frame"],
      ["Spacer", "Frame"],
    ]);
    expect(result.changed).toEqual([title?.id]);
    expect(title?.id).not.toBe("1:2");
  });

  it("puts a layer next to the copy's counterpart of the source layer before= or after= names", async () => {
    const result = await apply(
      '<Frame id="3:1"><Frame copyOf="1:1" name="Card 2"><Frame id="1:5"><Text name="Lead" before="1:2">Lead</Text><Text id="1:6" after="1:2"/></Frame></Frame></Frame>',
    );
    const copy = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(copy?.children?.[0]?.children?.map(({ name }) => name)).toEqual(["Lead", "Hello", "Read more"]);
    expect(byId("1:5")?.children?.map(({ id }) => id)).toEqual(["1:2", "1:6"]);
  });

  it("loads the fonts of a copy's texts before retyping them", async () => {
    const result = await apply('<Frame copyOf="1:1"><Frame id="1:5"><Text id="1:6">More</Text></Frame></Frame>', {
      parent: "3:1",
    });

    expect(result.errors).toEqual([]);
  });

  it("writes another instance's layer ids onto the new instance's own, never the other one's", async () => {
    const result = await apply(
      '<Frame id="3:1"><Instance component="Heading"><Frame id="I2:1;3:4"><Text id="I2:1;3:5">Our work</Text></Frame></Instance></Frame>',
    );
    const made = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(byId("I2:1;3:5")?.characters).toBe("Search engine");
    expect(made?.children?.[0]?.children?.[0]?.characters).toBe("Our work");
  });

  it("writes a new instance's layer as the XML says, even what the other instance it was read from has", async () => {
    const result = await apply(
      '<Frame id="3:1"><Instance component="Heading"><Frame id="I2:1;3:4"><Text id="I2:1;3:5">Search engine</Text></Frame></Instance></Frame>',
    );
    const made = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(made?.children?.[0]?.children?.[0]?.characters).toBe("Search engine");
  });

  it("switches the variant of a copy of an instance", async () => {
    const result = await apply('<Frame id="3:1"><Instance copyOf="2:1" variant="Property 1=Green"/></Frame>');

    expect(result.errors).toEqual([]);
    expect((byId(result.created[0]?.id ?? "") as FakeNode).mainComponent).toMatchObject({ id: "7:3" });
  });
});

describe("design_apply end to end: dry runs and moves", () => {
  it("checks an instance of a component the same XML makes, and a copy of an instance, without errors", async () => {
    const result = await apply(
      '<ComponentSet name="Tag"><Component variant="Tone=Dark"><Text prop="Label">A</Text></Component></ComponentSet>\n<Instance component="Tag" variant="Tone=Dark"/>\n<Instance copyOf="2:1"/>',
      {
        parent: "3:1",
        dryRun: true,
      },
    );

    expect(result.errors).toEqual([]);
  });

  it("moves a layer forward past the others, as Figma counts the index with the layer still in place", async () => {
    const result = await apply(
      '<Frame id="9:1"><Rectangle id="9:3"/><Rectangle id="9:4"/><Rectangle id="9:2"/></Frame>',
    );

    expect(result.errors).toEqual([]);
    expect(byId("9:1")?.children?.map(({ id }) => id)).toEqual(["9:3", "9:4", "9:2"]);
  });

  it("moves a nested layer before another, lists it as changed, in one undo step", async () => {
    const result = await apply('<Frame id="1:5"><Text id="1:6" before="1:2"/></Frame>');

    expect(byId("1:5")?.children?.map(({ id }) => id)).toEqual(["1:6", "1:2"]);
    expect(result.changed).toEqual(["1:6"]);
    expect(fake.writes.undo).toBe(1);
  });
});

describe("design_apply end to end: sections", () => {
  it("places a new frame in a section by its left and top, which nothing there lays out, absolute or not", async () => {
    const result = await apply(
      '<Section id="5:1"><Frame name="Card" left="40px" top="24px" width="100px" height="50px"/></Section>',
    );
    const card = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(card?.parent?.id).toBe("5:1");
    expect(card?.relativeTransform).toEqual([
      [1, 0, 40],
      [0, 1, 24],
    ]);

    const flowing = await apply('<Frame id="1:1"><Frame name="Flowing" left="4px"/></Frame>');

    expect(flowing.errors.map(({ attribute }) => attribute)).toEqual(["left"]);
  });

  it("moves a section on the page by its top alone, as design_read gives a layer there no position", async () => {
    const result = await apply('<Section id="5:1" top="320px"/>');

    expect(result.errors).toEqual([]);
    expect(byId("5:1")?.relativeTransform).toEqual([
      [1, 0, 0],
      [0, 1, 320],
    ]);
  });

  it("places a new layer on the page by its left and top alone, and refuses them where the call's parent lays it out", async () => {
    const result = await apply('<Frame name="Board" left="40px" top="2400px" width="100px" height="50px"/>');
    const board = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(board?.parent?.type).toBe("PAGE");
    expect(board?.relativeTransform).toEqual([
      [1, 0, 40],
      [0, 1, 2400],
    ]);

    const flowing = await apply('<Frame name="Flowing" left="4px"/>', { parent: "9:1" });

    expect(flowing.errors.map(({ attribute }) => attribute)).toEqual(["left"]);
  });
});

describe("design_apply end to end: layers two levels deep in one call", () => {
  it("overrides a text inside an instance's nested instance by its I<outer>;<inner>;<layer> id", async () => {
    const result = await apply(
      '<Instance id="2:9"><Instance id="I2:9;8:2"><Text id="I2:9;8:2;7:12" color="#FF0000">Buy</Text></Instance></Instance>',
    );
    const label = byId("I2:9;8:2;7:12");

    expect(result.errors).toEqual([]);
    expect(label?.characters).toBe("Buy");
    expect(label?.fills).toEqual([
      expect.objectContaining({
        color: {
          r: 1,
          g: 0,
          b: 0,
        },
      }),
    ]);
    expect(result.changed).toEqual(["I2:9;8:2;7:12"]);
  });

  it("sets the outer instance's text property, its fonts loaded, and switches its nested instance's variant", async () => {
    const result = await apply(
      '<Instance id="2:9" props="Title=Plans"><Instance id="I2:9;8:2" variant="State=Hover"/></Instance>',
    );

    expect(result.errors).toEqual([]);
    expect(byId("I2:9;8:3")?.characters).toBe("Plans");
    expect((byId("I2:9;8:2") as FakeNode).mainComponent).toMatchObject({ id: "7:13" });
    expect(result.changed).toEqual(["2:9", "I2:9;8:2"]);
  });

  it("writes a layer deep in a big screen when the screen and the section around it are named too", async () => {
    // More cards than one call's read takes whole: the layers named come first, the rest as far as it goes.
    const cards = Array.from({ length: 4000 }, (_, index) => ({
      id: `20:${index + 1}`,
      layoutMode: "VERTICAL",
      children: [{ id: `21:${index + 1}` }],
    }));

    installFigma(
      tree({
        id: "0:2",
        type: "PAGE",
        children: [
          {
            id: "1:1",
            layoutMode: "VERTICAL",
            children: [
              ...cards,
              {
                id: "1:2",
                layoutMode: "VERTICAL",
                children: [
                  {
                    id: "1:3",
                    layoutMode: "NONE",
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    const result = await apply('<Frame id="1:1"><Frame id="1:2"><Frame id="1:3" padding="8px"/></Frame></Frame>');

    expect(result.errors).toEqual([]);
    expect(result.changed).toEqual(["1:3"]);
  });

  it("writes a text inside a new instance's nested instance, the variant switched in the same call", async () => {
    const result = await apply(
      '<Frame id="3:1"><Instance component="Card"><Instance id="I2:9;8:2" variant="State=Hover"><Text id="I2:9;8:2;7:12">Buy</Text></Instance></Instance></Frame>',
    );
    const made = byId(result.created[0]?.id ?? "");

    expect(result.errors).toEqual([]);
    expect(made?.children?.[1]?.mainComponent).toMatchObject({ id: "7:13" });
    expect(made?.children?.[1]?.children?.[0]?.characters).toBe("Buy");
  });
});
