import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { textNode } from "./helpers/apply-document.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** design_apply end to end: the server's applyDesign over the plugin on the fake Figma. */
const apply = (xml: string, options: { dryRun?: boolean } = {}) =>
  applyDesign(pluginClient(plugin), {
    xml,
    dryRun: options.dryRun ?? false,
  });

/**
 * Two icons, a Card component whose icon is an instance swap property and whose title a text one, an instance of
 * it, a Button set of two variants without properties, and a board that is no component.
 */
function page(): FakeNode {
  return tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "4:1",
        name: "Star",
        type: "COMPONENT",
      },
      {
        id: "4:2",
        name: "Heart",
        type: "COMPONENT",
      },
      {
        id: "8:1",
        name: "Card",
        type: "COMPONENT",
        layoutMode: "VERTICAL",
        componentPropertyDefinitions: {
          "Icon#1:0": {
            type: "INSTANCE_SWAP",
            defaultValue: "4:1",
          },
          "Title#2:0": {
            type: "TEXT",
            defaultValue: "Hello",
          },
        },
        children: [
          {
            ...textNode("8:2", "Hello"),
            componentPropertyReferences: { characters: "Title#2:0" },
          },
          {
            id: "8:3",
            name: "Star",
            type: "INSTANCE",
            componentProperties: {},
            componentPropertyReferences: { mainComponent: "Icon#1:0" },
          },
          textNode("8:4", "Fine print"),
          {
            id: "8:5",
            name: "Heart",
            type: "INSTANCE",
            componentProperties: {},
          },
        ],
      },
      {
        id: "2:1",
        name: "Card",
        type: "INSTANCE",
        layoutMode: "VERTICAL",
        componentProperties: {
          "Icon#1:0": {
            type: "INSTANCE_SWAP",
            value: "4:1",
          },
          "Title#2:0": {
            type: "TEXT",
            value: "Hello",
          },
        },
        children: [
          {
            ...textNode("I2:1;8:2", "Hello"),
            componentPropertyReferences: { characters: "Title#2:0" },
          },
        ],
      },
      {
        id: "6:1",
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
            id: "6:2",
            name: "State=Default",
            type: "COMPONENT",
            layoutMode: "HORIZONTAL",
            children: [textNode("6:3", "Buy")],
          },
          {
            id: "6:4",
            name: "State=Hover",
            type: "COMPONENT",
            layoutMode: "HORIZONTAL",
            children: [textNode("6:5", "Buy")],
          },
        ],
      },
      {
        id: "3:1",
        name: "Board",
        layoutMode: "VERTICAL",
        children: [textNode("3:2", "Loose")],
      },
    ],
  });
}

let root: FakeNode;
let fake: ReturnType<typeof installFigma>;
const all = (from: FakeNode): FakeNode[] => [from, ...(from.children ?? []).flatMap(all)];
const byId = (id: string) => [...all(root), ...(fake?.writes.created ?? [])].find((node) => node.id === id) as FakeNode;
const calls = (method: string) => fake.writes.calls.filter((call) => call.method === method);

beforeEach(() => {
  root = page();

  for (const [instance, main] of [
    ["8:3", "4:1"],
    ["8:5", "4:2"],
    ["2:1", "8:1"],
  ] as const) {
    byId(instance).mainComponent = byId(main);
  }

  byId("6:1").defaultVariant = byId("6:2");
  fake = installFigma(root, {
    components: [
      tree({
        id: "9:1",
        name: "Bolt",
        type: "COMPONENT",
        key: "bolt-key",
      }),
    ],
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
    ],
  });
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("design_apply: an instance swap property through props", () => {
  it("takes a component by its name or a library one by key:, and names the near one for a name it lacks", async () => {
    const result = await apply('<Instance id="2:1" props="Icon=Heart"/>');

    expect(result.errors).toEqual([]);
    expect(byId("2:1").componentProperties).toMatchObject({ "Icon#1:0": { value: "4:2" } });

    await apply('<Instance id="2:1" props="Icon=key:bolt-key"/>');

    expect(byId("2:1").componentProperties).toMatchObject({ "Icon#1:0": { value: "9:1" } });

    const wrong = await apply('<Instance id="2:1" props="Icon=Hart"/>');

    expect(wrong.errors.map(({ attribute, message, hint }) => [attribute, `${message} ${hint ?? ""}`])).toEqual([
      ["props", expect.stringMatching(/named Hart.*Did you mean Heart\?/)],
    ]);
    expect(calls("setProperties")).toHaveLength(2);
  });
});

describe("design_apply: swapProp in a new component", () => {
  it("makes an instance swap property whose default is the instance's component, bound to the instance", async () => {
    const result = await apply('<Component name="Tile"><Instance component="Star" swapProp="Icon"/></Component>');
    const [tile] = fake.writes.created.filter(({ type }) => type === "COMPONENT");
    const [icon] = fake.writes.created.filter(({ type }) => type === "INSTANCE");

    expect(result.errors).toEqual([]);
    expect(tile?.componentPropertyDefinitions).toEqual({
      "Icon#1:0": {
        type: "INSTANCE_SWAP",
        defaultValue: "4:1",
      },
    });
    expect(icon?.componentPropertyReferences).toEqual({ mainComponent: "Icon#1:0" });
  });

  it("defines it once on a new set, every variant's instance bound to it", async () => {
    const result = await apply(
      [
        '<ComponentSet name="Tiles">',
        '<Component variant="Size=S"><Instance component="Star" swapProp="Icon"/></Component>',
        '<Component variant="Size=L"><Instance component="Star" swapProp="Icon"/></Component>',
        "</ComponentSet>",
      ].join(""),
    );
    const [set] = fake.writes.created.filter(({ type }) => type === "COMPONENT_SET");
    const icons = fake.writes.created.filter(({ type }) => type === "INSTANCE");

    expect(result.errors).toEqual([]);
    expect(Object.keys(set?.componentPropertyDefinitions as object)).toEqual(["Size", "Icon#2:0"]);
    expect(icons.map(({ componentPropertyReferences }) => componentPropertyReferences)).toEqual([
      { mainComponent: "Icon#2:0" },
      { mainComponent: "Icon#2:0" },
    ]);
  });

  it("refuses it on a layer that is no instance, and outside a component", async () => {
    const result = await apply(
      '<Component name="Tile"><Text swapProp="Icon">A</Text></Component>\n<Instance component="Star" swapProp="Icon"/>',
    );

    expect(result.errors.map(({ line, attribute, message }) => [line, attribute, message])).toEqual([
      [1, "swapProp", expect.stringMatching(/instance swap property: it goes on an <Instance>/)],
      [2, "swapProp", expect.stringMatching(/swapProp makes a property of/)],
    ]);
    expect(calls("addComponentProperty")).toEqual([]);
  });

  it("writes nothing for the $swapProp design_read gives a bound instance", async () => {
    const result = await apply('<Component id="8:1"><Instance id="8:3" $swapProp="Icon"/></Component>');

    expect(result).toMatchObject({
      created: [],
      changed: [],
      errors: [],
    });
    expect(calls("addComponentProperty")).toEqual([]);
  });
});

describe("design_apply: properties on an existing component", () => {
  it("binds a layer to the property of that name the component has, and adds one it lacks, once", async () => {
    const result = await apply(
      [
        '<Component id="8:1"><Text id="8:4" prop="Note"/><Instance id="8:5" swapProp="Icon"/>',
        '<Text prop="Caption">New</Text></Component>',
        '<Text id="8:2" prop="Note"/>',
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(byId("8:5").componentPropertyReferences).toEqual({ mainComponent: "Icon#1:0" });
    expect(calls("addComponentProperty").map(({ args }) => args)).toEqual([
      ["Note", "TEXT", "Fine print"],
      ["Caption", "TEXT", "New"],
    ]);
    expect([byId("8:4"), byId("8:2")].map(({ componentPropertyReferences }) => componentPropertyReferences)).toEqual([
      { characters: "Note#3:0" },
      { characters: "Note#3:0" },
    ]);
    expect(result.changed).toEqual(["8:4", "8:5", "8:2"]);
    expect(result.properties).toEqual([
      {
        component: "8:1",
        name: "Note",
        type: "TEXT",
      },
      {
        component: "8:1",
        name: "Caption",
        type: "TEXT",
      },
    ]);
  });

  it("adds a variant's property on its set, once for every variant, its default the layer's value now", async () => {
    const result = await apply(
      '<Text id="6:3" prop="Label" visibleProp="Shown" display="none"/>\n<Text id="6:5" prop="Label"/>',
    );

    expect(result.errors).toEqual([]);
    expect(byId("6:1").componentPropertyDefinitions).toMatchObject({
      "Label#2:0": {
        type: "TEXT",
        defaultValue: "Buy",
      },
      "Shown#3:0": {
        type: "BOOLEAN",
        defaultValue: false,
      },
    });
    expect([byId("6:3"), byId("6:5")].map(({ componentPropertyReferences }) => componentPropertyReferences)).toEqual([
      {
        characters: "Label#2:0",
        visible: "Shown#3:0",
      },
      { characters: "Label#2:0" },
    ]);
  });

  it("refuses a name another type of property has, and a layer no component holds, adding nothing", async () => {
    const result = await apply(
      '<Text id="8:4" visibleProp="Title"/>\n<Text id="3:2" prop="Loose"/>\n<Text id="I2:1;8:2" prop="Heading"/>',
    );

    expect(result.errors.map(({ line, attribute, message }) => [line, attribute, message])).toEqual([
      [1, "visibleProp", expect.stringMatching(/Card has a text property Title/)],
      [2, "prop", expect.stringMatching(/No component holds this layer/)],
      [3, "prop", expect.stringMatching(/inside an instance/)],
    ]);
    expect(calls("addComponentProperty")).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it("sends nothing for a layer bound as it says already", async () => {
    const result = await apply('<Text id="8:2" prop="Title"/>\n<Instance id="8:3" swapProp="Icon"/>');

    expect(result).toMatchObject({
      changed: [],
      errors: [],
    });
  });

  it("reports in a dry run what it would add, once, and what it would refuse, writing nothing", async () => {
    const result = await apply(
      '<Text id="6:3" prop="Label"/>\n<Text id="6:5" prop="Label"/>\n<Component id="8:1"><Text prop="Title">Hi</Text></Component>\n<Text id="8:4" visibleProp="Title"/>',
      { dryRun: true },
    );

    expect(result.properties).toEqual([
      {
        component: "6:1",
        name: "Label",
        type: "TEXT",
      },
    ]);
    expect(result.errors.map(({ line, attribute }) => [line, attribute])).toEqual([[4, "visibleProp"]]);
    expect(calls("addComponentProperty")).toEqual([]);
    expect(byId("6:3").componentPropertyReferences).toBeUndefined();
  });
});
