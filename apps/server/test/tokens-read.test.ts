import { describe, expect, it } from "vitest";
import { readTokens } from "../src/tokens/tokens.ts";
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

function bridgeAnswering(answer: object): { bridge: BridgeView; inputs: unknown[] } {
  const inputs: unknown[] = [];

  return {
    inputs,
    bridge: {
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
    },
  };
}

describe("tokens_read", () => {
  it("returns CSS with a summary by default, and the token model as JSON when asked", async () => {
    const { bridge } = bridgeAnswering(RAW);
    const css = await readTokens(bridge, {
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

    const json = await readTokens(bridge, {
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

  it("says which collections exist when a filter matches none", async () => {
    const { bridge } = bridgeAnswering(RAW);
    const read = await readTokens(bridge, {
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
      bridgeAnswering({
        ...RAW,
        libraryError: "The libraries could not be read: Offline",
      }).bridge,
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
      bridgeAnswering({
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
      }).bridge,
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
    const read = await readTokens(bridgeAnswering(many).bridge, {
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
      bridgeAnswering({
        ...RAW,
        library: [],
      }).bridge,
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
