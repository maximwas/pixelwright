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
            componentPropertyReferences: { mainComponent: "Icon#1:0" },
          },
          textNode("8:4", "Fine print"),
          {
            id: "8:5",
            name: "Heart",
            type: "INSTANCE",
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
        children: [],
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
