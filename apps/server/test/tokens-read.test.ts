import { describe, expect, it } from "vitest";
import { readTokens } from "../src/features/tokens-read/read-tokens.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const RAW = {
  collections: [
    {
      id: "C:1",
      name: "Brand",
      remote: false,
      defaultModeId: "M:1",
      modes: [
        {
          modeId: "M:1",
          name: "Light",
        },
        {
          modeId: "M:2",
          name: "Dark",
        },
      ],
    },
  ],
  variables: [
    {
      id: "V:1",
      name: "Ink",
      collectionId: "C:1",
      resolvedType: "COLOR",
      scopes: ["ALL_SCOPES"],
      valuesByMode: {
        "M:1": {
          r: 0,
          g: 0,
          b: 0,
          a: 1,
        },
        "M:2": {
          r: 1,
          g: 1,
          b: 1,
          a: 1,
        },
      },
    },
  ],
  external: {},
  styles: [],
};

function pluginAnswering(answer: object): { plugin: PluginClient; inputs: unknown[] } {
  const inputs: unknown[] = [];

  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: true,
      },
    ],
    request: async (_op, input) => {
      inputs.push(input);

      return answer;
    },
  };

  return {
    plugin: new PluginClient(bridge),
    inputs,
  };
}

describe("tokens_read", () => {
  it("returns CSS with a summary by default, and the token model as JSON when asked", async () => {
    const { plugin } = pluginAnswering(RAW);
    const css = await readTokens(plugin, {
      libraries: false,
      used: true,
      format: "css",
      maxChars: 80_000,
    });

    expect(css.css).toContain('[data-brand="dark"] {\n  --Ink: #FFF;\n}');
    expect(css.summary).toEqual({
      collections: [
        {
          name: "Brand",
          modes: ["Light", "Dark"],
          variables: 1,
        },
      ],
      styles: {
        paint: 0,
        text: 0,
        effect: 0,
      },
    });

    const json = await readTokens(plugin, {
      libraries: false,
      used: true,
      format: "json",
      maxChars: 80_000,
    });

    expect(json.tokens?.collections[0]?.variables[0]?.values).toEqual({
      Light: "#000",
      Dark: "#FFF",
    });
    expect(json).not.toHaveProperty("css");
  });

  it("returns DTCG trees per collection mode when asked, with what DTCG cannot hold in notes", async () => {
    const { plugin } = pluginAnswering(RAW);
    const read = await readTokens(plugin, {
      libraries: false,
      used: true,
      format: "dtcg",
      maxChars: 80_000,
    });

    expect(read.format).toBe("dtcg");
    expect(Object.keys(read.dtcg ?? {})).toEqual(["brand.light", "brand.dark", "styles"]);
    expect(read.dtcg?.["brand.dark"]?.Ink).toEqual({
      $type: "color",
      $value: {
        colorSpace: "srgb",
        components: [1, 1, 1],
        hex: "#FFFFFF",
      },
    });
    expect(read).not.toHaveProperty("css");
    expect(read).not.toHaveProperty("tokens");
  });

  it("gives DTCG past maxChars as the summary and the collections to ask for", async () => {
    const many = {
      ...RAW,
      variables: Array.from({ length: 200 }, (_, index) => ({
        ...RAW.variables[0],
        id: `V:${index}`,
        name: `color/shade-${index}`,
      })),
    };
    const read = await readTokens(pluginAnswering(many).plugin, {
      libraries: false,
      used: true,
      format: "dtcg",
      maxChars: 2_000,
    });

    expect(read).not.toHaveProperty("dtcg");
    expect(read.summary?.collections[0]?.variables).toBe(200);
    expect(read.notes.join("\n")).toMatch(/past maxChars/);
  });

  it("says which collections exist when a filter matches none", async () => {
    const { plugin } = pluginAnswering(RAW);
    const read = await readTokens(plugin, {
      libraries: false,
      used: true,
      format: "css",
      maxChars: 80_000,
      collections: ["Spacing"],
    });

    expect(read.notes).toContainEqual(expect.stringMatching(/No collection is named Spacing.*Brand/));
  });

  it("keeps the local tokens when the libraries cannot be read, and lists a big library only in part", async () => {
    const failed = await readTokens(
      pluginAnswering({
        ...RAW,
        libraryError: "The libraries could not be read: Offline",
      }).plugin,
      {
        libraries: true,
        used: true,
        format: "css",
        maxChars: 80_000,
      },
    );

    expect(failed.css).toContain("--Ink: #000;");
    expect(failed.notes).toContainEqual(expect.stringMatching(/Offline/));

    const big = await readTokens(
      pluginAnswering({
        ...RAW,
        library: [
          {
            libraryName: "DS",
            collection: "Core",
            key: "K",
            variables: Array.from({ length: 900 }, (_, index) => ({
              name: `c/${index}`,
              key: `k${index}`,
              resolvedType: "COLOR",
            })),
          },
        ],
      }).plugin,
      {
        libraries: true,
        used: true,
        format: "css",
        maxChars: 80_000,
      },
    );

    expect(big.library?.[0]?.variables).toHaveLength(500);
    expect(big.notes).toContainEqual(expect.stringMatching(/400 more library variables/));
  });
});

describe("tokens_read review fixes", () => {
  it("keeps to maxChars: past it, the summary and the collections to ask for instead of the CSS", async () => {
    const many = {
      ...RAW,
      variables: Array.from({ length: 2_000 }, (_, index) => ({
        ...RAW.variables[0],
        id: `V:${index}`,
        name: `color/${index}`,
      })),
    };
    const read = await readTokens(pluginAnswering(many).plugin, {
      libraries: false,
      used: true,
      format: "css",
      maxChars: 20_000,
    });

    expect(read).not.toHaveProperty("css");
    expect(read.summary?.collections).toEqual([
      {
        name: "Brand",
        modes: ["Light", "Dark"],
        variables: 2_000,
      },
    ]);
    expect(read.notes).toContainEqual(expect.stringMatching(/maxChars.*collections: \["Brand"\]/));
  });

  it("says when no library with variables is enabled", async () => {
    const read = await readTokens(
      pluginAnswering({
        ...RAW,
        library: [],
      }).plugin,
      {
        libraries: true,
        used: true,
        format: "css",
        maxChars: 80_000,
      },
    );

    expect(read.notes).toContainEqual(expect.stringMatching(/No library with variables is enabled/));
  });
});
