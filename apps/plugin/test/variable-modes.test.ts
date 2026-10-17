import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { PluginClient } from "../../server/src/plugin/plugin-client.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const COLLECTIONS = [
  {
    id: "C:theme",
    name: "Color modes",
    remote: false,
    defaultModeId: "M:light",
    modes: [
      {
        modeId: "M:light",
        name: "Light",
      },
      {
        modeId: "M:dark",
        name: "Dark",
      },
    ],
  },
  {
    id: "C:space",
    name: "Spacing",
    remote: false,
    defaultModeId: "M:base",
    modes: [
      {
        modeId: "M:base",
        name: "Base",
      },
    ],
  },
];

let page: FakeNode;
let writes: ReturnType<typeof installFigma>["writes"];

const node = (id: string): FakeNode => {
  const find = (at: FakeNode): FakeNode | undefined =>
    at.id === id ? at : (at.children ?? []).map(find).find((found) => found !== undefined);

  return find(page) as FakeNode;
};

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    explicitVariableModes: { "C:theme": "M:dark" },
    children: [
      {
        id: "1:1",
        name: "Section",
        layoutMode: "VERTICAL",
        explicitVariableModes: {},
        children: [
          {
            id: "1:2",
            name: "Card",
            explicitVariableModes: { "C:theme": "M:light" },
          },
        ],
      },
    ],
  });
  ({ writes } = installFigma(page, { localCollections: COLLECTIONS }));
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const client = () => new PluginClient(pluginBridge(plugin));

const read = async (id: string) => {
  const result = await readDesign(client(), {
    node: id,
    screenshot: false,
    maxChars: 80_000,
    code: false,
  });

  return (result.content[0] as { text: string }).text;
};

const apply = (xml: string) =>
  applyDesign(client(), {
    xml,
    dryRun: false,
  });

describe("variable modes on layers", () => {
  it("reads a layer's own mode, and the root's from the page above it, as data attributes", async () => {
    const xml = await read("1:1");

    expect(xml).toContain('<Frame id="1:1" name="Section" data-color-modes="dark"');
    expect(xml).toContain('<Frame id="1:2" name="Card" data-color-modes="light"');
    expect(xml).not.toContain("data-spacing");
  });

  it("reads with Figma offline: the file's own collections need no lookup by id, a library's is left out", async () => {
    const variables = (globalThis as unknown as { figma: { variables: Record<string, unknown> } }).figma.variables;

    // Offline, Figma gives up on a lookup by id after ten seconds, even for a collection of the file's own.
    variables.getVariableCollectionByIdAsync = async () => {
      throw new Error("Unable to establish connection to Figma after 10 seconds.");
    };
    node("1:1").resolvedVariableModes = {
      "C:theme": "M:dark",
      "C:library": "M:other",
    };

    expect(await read("1:1")).toContain('<Frame id="1:1" name="Section" data-color-modes="dark"');
  });

  it("changes nothing when a read comes back as it was", async () => {
    await expect(apply(await read("1:1"))).resolves.toMatchObject({
      created: [],
      changed: [],
      errors: [],
    });
    expect(writes.calls.filter(({ method }) => method.includes("VariableMode"))).toEqual([]);
  });

  it("sets a mode by its slug or its name, and clears one with an empty value", async () => {
    await expect(
      apply('<Frame id="1:1" data-color-modes="Light"/><Frame id="1:2" data-color-modes=""/>'),
    ).resolves.toMatchObject({ errors: [] });

    expect(node("1:1").explicitVariableModes).toEqual({ "C:theme": "M:light" });
    expect(node("1:2").explicitVariableModes).toEqual({});
  });

  it("names the collections and modes there are when one is wrong, and sets none of the layer's", async () => {
    const result = await apply('<Frame id="1:1" data-theme="dark"/><Frame id="1:2" data-color-modes="dim"/>');

    expect(result.errors.map(({ message, hint }) => `${message} ${hint}`)).toEqual([
      "No variable collection is named theme here. It has Color modes (data-color-modes), Spacing (data-spacing).",
      'Color modes has no mode dim. It has Light ("light"), Dark ("dark").',
    ]);
    expect(node("1:1").explicitVariableModes).toEqual({});
  });
});
