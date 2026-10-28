import { describe, expect, it, vi } from "vitest";
import { type FakeLibrary, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const WHITE = {
  r: 1,
  g: 1,
  b: 1,
  a: 1,
};
const DARK = {
  r: 0.098,
  g: 0.102,
  b: 0.137,
  a: 1,
};

/** A file with two collections, an alias across them, an alias to a library variable, styles and one library. */
const LIBRARY: FakeLibrary = {
  localCollections: [
    {
      id: "C:brand",
      name: "Brand",
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
  ],
  localVariables: [
    {
      id: "V:surface",
      name: "Surface",
      variableCollectionId: "C:brand",
      resolvedType: "COLOR",
      description: "Page background",
      scopes: ["FRAME_FILL"],
      codeSyntax: { WEB: "var(--surface)" },
      valuesByMode: {
        "M:light": WHITE,
        "M:dark": {
          type: "VARIABLE_ALIAS",
          id: "V:ink",
        },
      },
    },
    {
      id: "V:ink",
      name: "Ink",
      variableCollectionId: "C:brand",
      resolvedType: "COLOR",
      description: "",
      scopes: ["ALL_SCOPES"],
      codeSyntax: {},
      valuesByMode: {
        "M:light": DARK,
        "M:dark": {
          type: "VARIABLE_ALIAS",
          id: "V:lib-accent",
        },
      },
    },
    {
      id: "V:gap",
      name: "space/4",
      variableCollectionId: "C:space",
      resolvedType: "FLOAT",
      description: "",
      scopes: ["GAP"],
      codeSyntax: {},
      valuesByMode: { "M:base": 16 },
    },
  ],
  // The library variable the dark Ink points at, as getVariableByIdAsync finds it.
  variables: {
    "V:lib-accent": {
      id: "V:lib-accent",
      name: "Accent",
      variableCollectionId: "C:lib",
      resolvedType: "COLOR",
      remote: true,
      description: "",
      scopes: ["ALL_SCOPES"],
      valuesByMode: { "M:core": WHITE },
    },
  },
  collections: {
    "C:lib": {
      id: "C:lib",
      name: "Core",
      remote: true,
      defaultModeId: "M:core",
      modes: [
        {
          modeId: "M:core",
          name: "Default",
        },
      ],
    },
  },
  localStyles: {
    paint: [
      {
        id: "S:green",
        name: "Green",
        type: "PAINT",
        remote: false,
        paints: [
          {
            type: "SOLID",
            color: {
              r: 0.72,
              g: 1,
              b: 0.4,
            },
          },
        ],
      },
    ],
    text: [
      {
        id: "S:h3",
        name: "h3",
        type: "TEXT",
        remote: false,
        fontName: {
          family: "Space Grotesk",
          style: "Medium",
        },
        fontSize: 30,
        lineHeight: { unit: "AUTO" },
        letterSpacing: {
          unit: "PERCENT",
          value: 0,
        },
        textCase: "ORIGINAL",
        textDecoration: "NONE",
      },
    ],
  },
  teamLibrary: {
    collections: [
      {
        key: "K:core",
        name: "Core",
        libraryName: "Design System",
      },
    ],
    variables: {
      "K:core": [
        {
          key: "k1",
          name: "Accent",
          resolvedType: "COLOR",
        },
      ],
    },
  },
};

const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
  });

describe("variables", () => {
  it("says the file's colour profile, and nothing where Figma does not give one", async () => {
    const { figma } = installFigma(page(), LIBRARY);

    expect(await plugin.run("variables", {})).not.toHaveProperty("colorProfile");

    Object.assign(figma.root, { documentColorProfile: "DISPLAY_P3" });

    expect(await plugin.run("variables", {})).toMatchObject({ colorProfile: "DISPLAY_P3" });
  });

  it("reads every collection with its modes and every variable's value per mode, aliases kept", async () => {
    installFigma(page(), LIBRARY);

    const tokens = (await plugin.run("variables", {})) as Record<string, unknown>;

    expect((tokens.collections as unknown[]).slice(0, 2)).toEqual([
      {
        id: "C:brand",
        name: "Brand",
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
    ]);
    expect(tokens.variables).toContainEqual({
      id: "V:surface",
      name: "Surface",
      collectionId: "C:brand",
      resolvedType: "COLOR",
      description: "Page background",
      scopes: ["FRAME_FILL"],
      codeSyntax: { WEB: "var(--surface)" },
      valuesByMode: {
        "M:light": WHITE,
        "M:dark": {
          type: "VARIABLE_ALIAS",
          id: "V:ink",
        },
      },
    });
    // A library variable a local alias points at comes whole, with its collection, so its token is defined.
    expect(tokens.external).toEqual({});
    expect(tokens.variables).toContainEqual(
      expect.objectContaining({
        id: "V:lib-accent",
        name: "Accent",
        valuesByMode: { "M:core": WHITE },
      }),
    );
    expect(tokens.collections).toContainEqual(
      expect.objectContaining({
        id: "C:lib",
        name: "Core",
        remote: true,
      }),
    );
    expect(tokens.styles).toEqual([
      expect.objectContaining({
        id: "S:green",
        name: "Green",
        type: "PAINT",
      }),
      expect.objectContaining({
        id: "S:h3",
        name: "h3",
        type: "TEXT",
        fontSize: 30,
      }),
    ]);
    expect(tokens).not.toHaveProperty("library");
  });

  it("lists the enabled libraries' variables by name when asked, and says why when it cannot", async () => {
    installFigma(page(), LIBRARY);

    const withLibrary = (await plugin.run("variables", { libraries: true })) as Record<string, unknown>;

    expect(withLibrary.library).toEqual([
      {
        libraryName: "Design System",
        collection: "Core",
        key: "K:core",
        variables: [
          {
            key: "k1",
            name: "Accent",
            resolvedType: "COLOR",
          },
        ],
      },
    ]);

    installFigma(page(), {
      ...LIBRARY,
      teamLibrary: new Error("Offline"),
    });

    const offline = (await plugin.run("variables", { libraries: true })) as Record<string, unknown>;

    expect(offline.libraryError).toMatch(/Offline/);
    expect((offline.variables as unknown[]).length).toBe(4);
  });
});

describe("variables the page uses from a library", () => {
  it("adds the library styles and variables the layers use, with their collections and modes", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "2:1",
            name: "Card",
            fillStyleId: "S:lib-grey",
            fills: [
              {
                type: "SOLID",
                color: WHITE,
                boundVariables: {
                  color: {
                    type: "VARIABLE_ALIAS",
                    id: "V:lib-surface",
                  },
                },
              },
            ],
            children: [
              {
                id: "2:2",
                type: "TEXT",
                name: "Title",
                textStyleId: "S:lib-h3",
              },
            ],
          },
        ],
      }),
      {
        styles: {
          "S:lib-grey": {
            id: "S:lib-grey",
            name: "Grey",
            type: "PAINT",
            remote: true,
            paints: [
              {
                type: "SOLID",
                color: {
                  r: 0.95,
                  g: 0.95,
                  b: 0.95,
                },
              },
            ],
          },
          "S:lib-h3": {
            id: "S:lib-h3",
            name: "h3",
            type: "TEXT",
            remote: true,
            fontName: {
              family: "Space Grotesk",
              style: "Medium",
            },
            fontSize: 30,
            lineHeight: { unit: "AUTO" },
            letterSpacing: {
              unit: "PERCENT",
              value: 0,
            },
            textCase: "ORIGINAL",
            textDecoration: "NONE",
          },
        },
        variables: {
          "V:lib-surface": {
            id: "V:lib-surface",
            name: "Surface",
            variableCollectionId: "C:lib",
            resolvedType: "COLOR",
            remote: true,
            description: "",
            scopes: ["ALL_SCOPES"],
            valuesByMode: {
              "M:l": WHITE,
              "M:d": {
                type: "VARIABLE_ALIAS",
                id: "V:lib-ink",
              },
            },
          },
          "V:lib-ink": {
            id: "V:lib-ink",
            name: "Ink",
            variableCollectionId: "C:lib",
            resolvedType: "COLOR",
            remote: true,
            description: "",
            scopes: ["ALL_SCOPES"],
            valuesByMode: {
              "M:l": DARK,
              "M:d": WHITE,
            },
          },
        },
        collections: {
          "C:lib": {
            id: "C:lib",
            name: "Theme",
            remote: true,
            defaultModeId: "M:l",
            modes: [
              {
                modeId: "M:l",
                name: "Light",
              },
              {
                modeId: "M:d",
                name: "Dark",
              },
            ],
          },
        },
      },
    );

    const tokens = (await plugin.run("variables", {})) as {
      collections: { name: string; remote: boolean; modes: unknown[] }[];
      variables: { name: string; valuesByMode: Record<string, unknown> }[];
      styles: { name: string; remote: boolean }[];
    };

    expect(tokens.styles.map(({ name, remote }) => [name, remote])).toEqual([
      ["Grey", true],
      ["h3", true],
    ]);
    expect(tokens.collections).toEqual([
      {
        id: "C:lib",
        name: "Theme",
        remote: true,
        defaultModeId: "M:l",
        modes: [
          {
            modeId: "M:l",
            name: "Light",
          },
          {
            modeId: "M:d",
            name: "Dark",
          },
        ],
      },
    ]);
    expect(tokens.variables.map(({ name }) => name).sort()).toEqual(["Ink", "Surface"]);

    const onlyLocal = (await plugin.run("variables", { used: false })) as { styles: unknown[]; variables: unknown[] };

    expect(onlyLocal).toMatchObject({
      styles: [],
      variables: [],
    });
  });
});

describe("a slow library catalogue", () => {
  it("stops reading it at its time budget, keeps what it read and the local tokens, and says why", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      installFigma(page(), {
        ...LIBRARY,
        teamLibrary: {
          collections: ["A", "B", "C"].map((name) => ({
            key: `K:${name}`,
            name,
            libraryName: "DS",
          })),
          variables: {},
        },
      });
      Object.assign((globalThis as unknown as { figma: { teamLibrary: object } }).figma.teamLibrary, {
        getVariablesInLibraryCollectionAsync: async () => {
          vi.setSystemTime(Date.now() + 15_000);

          return [
            {
              key: "k",
              name: "x",
              resolvedType: "COLOR",
            },
          ];
        },
      });

      const tokens = (await plugin.run("variables", { libraries: true })) as Record<string, unknown>;

      expect(tokens.library).toHaveLength(1);
      expect(tokens.libraryError).toMatch(/1 of 3/);
      expect((tokens.variables as unknown[]).length).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
