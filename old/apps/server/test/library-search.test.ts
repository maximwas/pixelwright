import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { searchLibraries } from "../src/features/library-search/search-libraries.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A component as the plugin lists a file's own. */
const entry = (name: string, key: string, extra: Record<string, unknown> = {}) => ({
  id: `1:${key}`,
  key,
  type: "COMPONENT",
  name,
  page: "Components",
  remote: false,
  properties: {},
  ...extra,
});

const BUTTON = entry("Button", "k-button", {
  type: "COMPONENT_SET",
  description: "Primary actions",
  variants: [
    {
      id: "1:10",
      name: "State=Default",
    },
  ],
  properties: {
    State: {
      type: "VARIANT",
      default: "Default",
      options: ["Default", "Hover"],
    },
  },
});

/** A plugin in a file of this name answering components with these entries, recording what it was asked. */
function plugin(fileName: string, components: unknown[], extra: Record<string, unknown> = {}) {
  const asked: Record<string, unknown>[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo({
          file: {
            name: fileName,
            key: null,
          },
        }),
        active: true,
      },
    ],
    request: async (op, input) => {
      if (op !== "components") {
        throw new Error(`unexpected ${op}`);
      }

      asked.push(input as Record<string, unknown>);

      return {
        components,
        more: false,
        ...extra,
      };
    },
  };

  return {
    client: new PluginClient(bridge),
    asked,
  };
}

const folder = () => mkdtemp(join(tmpdir(), "pixelwright-libraries-"));
const search = (query: string) => ({
  query,
  save: false,
  limit: 20,
});
const save = {
  save: true,
  limit: 20,
};

describe("library_search", () => {
  it("saves a library file's own published components under its name, leaving out those Figma does not publish", async () => {
    const dir = await folder();
    const { client, asked } = plugin("Orbit DS", [
      BUTTON,
      entry(".Base", "k-base"),
      entry("_Helper", "k-helper"),
      entry("Badge", "k-badge"),
    ]);

    const answer = await searchLibraries(client, save, dir);
    const stored = JSON.parse(await readFile(join(dir, "orbit-ds.json"), "utf8"));

    expect(asked).toEqual([
      {
        scope: "local",
        limit: 500,
      },
    ]);
    expect(answer.saved).toEqual({
      library: "Orbit DS",
      path: join(dir, "orbit-ds.json"),
      components: 2,
    });
    expect(stored.name).toBe("Orbit DS");
    expect(stored.components.map((component: { key: string }) => component.key)).toEqual(["k-button", "k-badge"]);
    expect(stored.components[0]).toEqual({
      key: "k-button",
      type: "COMPONENT_SET",
      name: "Button",
      page: "Components",
      description: "Primary actions",
      properties: BUTTON.properties,
    });
  });

  it("finds components across the saved libraries by words in any order, and gives the key design_apply inserts", async () => {
    const dir = await folder();

    await searchLibraries(plugin("Orbit DS", [BUTTON, entry("Badge", "k-badge")]).client, save, dir);
    await searchLibraries(plugin("Icons", [entry("Arrow right", "k-arrow")]).client, save, dir);

    const { client } = plugin("Product", []);
    const hover = await searchLibraries(client, search("hover button"), dir);
    const arrow = await searchLibraries(client, search("arow"), dir);

    expect(hover.components).toEqual([
      {
        library: "Orbit DS",
        name: "Button",
        type: "COMPONENT_SET",
        component: "key:k-button",
        page: "Components",
        description: "Primary actions",
        properties: BUTTON.properties,
      },
    ]);
    expect(arrow.components?.map((found) => found.component)).toEqual(["key:k-arrow"]);
    expect(hover.libraries.map((library) => [library.name, library.components])).toEqual([
      ["Icons", 1],
      ["Orbit DS", 2],
    ]);
  });

  it("says how to save a library when none is saved, and names a catalogue it cannot read", async () => {
    const dir = await folder();
    const { client } = plugin("Product", []);

    const empty = await searchLibraries(client, search("button"), dir);

    await writeFile(join(dir, "broken.json"), "{");

    const broken = await searchLibraries(client, search("button"), dir);

    expect(empty.components).toEqual([]);
    expect(empty.notes?.join(" ")).toMatch(/save: true/);
    expect(broken.notes?.join(" ")).toContain("broken.json");
  });

  it("notes a library cut short or a page not read when saving", async () => {
    const dir = await folder();
    const { client } = plugin("Big DS", [BUTTON], {
      more: true,
      pagesNotRead: [
        {
          name: "Old",
          error: "offline",
        },
      ],
    });

    const answer = await searchLibraries(client, save, dir);

    expect(answer.notes?.join(" ")).toMatch(/first 500/);
    expect(answer.notes?.join(" ")).toMatch(/Old/);
  });

  it("cuts the results to the limit and says there are more", async () => {
    const dir = await folder();
    const buttons = ["Button", "Button/Icon", "Button/Link"].map((name, at) => entry(name, `k-${at}`));

    await searchLibraries(plugin("Orbit DS", buttons).client, save, dir);

    const answer = await searchLibraries(
      plugin("Product", []).client,
      {
        query: "button",
        save: false,
        limit: 2,
      },
      dir,
    );

    expect(answer.components).toHaveLength(2);
    expect(answer.more).toBe(true);
  });
});
