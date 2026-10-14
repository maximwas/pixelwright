import { TokensApplyInputSchema, tokensPlan } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Applied {
  created: { kind: string; name: string; collection?: string }[];
  updated: { kind: string; name: string; collection?: string }[];
  errors: { kind: string; name: string; collection?: string; mode?: string; message: string }[];
}

const BLACK = {
  r: 0,
  g: 0,
  b: 0,
  a: 1,
};
const WHITE = {
  r: 1,
  g: 1,
  b: 1,
  a: 1,
};

/** tokens_apply's input in CSS, as the server turns it into a plan. */
const apply = async (input: unknown, dryRun = false) => {
  const { plan, errors } = tokensPlan(TokensApplyInputSchema.parse(input));

  expect(errors).toEqual([]);

  return (await plugin.run("tokens_apply", {
    plan,
    dryRun,
  })) as Applied;
};

let fake: ReturnType<typeof installFigma>;
const store = async () => ({
  collections: await figma.variables.getLocalVariableCollectionsAsync(),
  variables: await figma.variables.getLocalVariablesAsync(),
});
const variableNamed = async (name: string) => (await store()).variables.find((variable) => variable.name === name);

beforeEach(() => {
  fake = installFigma(
    tree({
      id: "0:1",
      type: "PAGE",
      children: [],
    }),
    {
      modeLimit: 2,
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
          id: "C:theme",
          name: "Theme",
          remote: false,
          defaultModeId: "M:theme",
          modes: [
            {
              modeId: "M:theme",
              name: "Default",
            },
          ],
        },
      ],
      localVariables: [
        {
          id: "V:primary",
          name: "color/primary",
          variableCollectionId: "C:brand",
          resolvedType: "COLOR",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "M:light": BLACK,
            "M:dark": WHITE,
          },
        },
        {
          id: "V:ink",
          name: "ink",
          variableCollectionId: "C:theme",
          resolvedType: "COLOR",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "M:theme": {
              type: "VARIABLE_ALIAS",
              id: "L:green",
            },
          },
        },
      ],
      // A library's colour the file's Ink points at, in a collection the file does not own.
      variables: {
        "L:green": {
          id: "L:green",
          name: "Green",
          variableCollectionId: "LC:library",
          resolvedType: "COLOR",
          remote: true,
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "LM:1": {
              r: 0,
              g: 1,
              b: 0,
              a: 1,
            },
          },
        },
      },
      collections: {
        "LC:library": {
          id: "LC:library",
          name: "Library colors",
          remote: true,
          defaultModeId: "LM:1",
          modes: [
            {
              modeId: "LM:1",
              name: "Value",
            },
          ],
        },
      },
    },
  );
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("tokens_apply: variables", () => {
  it("makes a collection with its modes, the first by renaming Figma's default, and its variables", async () => {
    const result = await apply({
      collections: [
        {
          name: "Space",
          modes: ["Mobile", "Desktop"],
          variables: [
            {
              name: "s",
              values: {
                Mobile: "8px",
                Desktop: "12px",
              },
            },
          ],
        },
      ],
    });
    const space = (await store()).collections.find((collection) => collection.name === "Space");
    const s = await variableNamed("s");

    expect(result).toEqual({
      created: [
        {
          kind: "collection",
          name: "Space",
        },
        {
          kind: "mode",
          collection: "Space",
          name: "Mobile",
        },
        {
          kind: "mode",
          collection: "Space",
          name: "Desktop",
        },
        {
          kind: "variable",
          collection: "Space",
          name: "s",
        },
      ],
      updated: [],
      errors: [],
    });
    expect(space?.modes.map(({ name }) => name)).toEqual(["Mobile", "Desktop"]);
    expect(Object.values(s?.valuesByMode ?? {})).toEqual([8, 12]);
    expect(fake.writes.undo).toBe(1);
  });

  it("sets only what differs, so the same tokens again change nothing", async () => {
    const input = {
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "color/primary",
              values: {
                Light: "#000000",
                Dark: "#FF0000",
              },
            },
          ],
        },
      ],
    };

    expect(await apply(input)).toEqual({
      created: [],
      updated: [
        {
          kind: "variable",
          collection: "Brand",
          name: "color/primary",
        },
      ],
      errors: [],
    });
    expect(fake.writes.calls.filter(({ method }) => method === "setValueForMode").map(({ args }) => args[0])).toEqual([
      "M:dark",
    ]);
    expect(await apply(input)).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
    expect(fake.writes.undo).toBe(1);
  });

  it("keeps a Display P3 colour as it is in a P3 file, so the same tokens again change nothing", async () => {
    Object.assign(fake.figma.root, { documentColorProfile: "DISPLAY_P3" });

    const input = {
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "color/accent",
              values: { Light: "color(display-p3 0.9 0.2 0.1)" },
            },
          ],
        },
      ],
    };

    await apply(input);

    const stored = Object.values((await variableNamed("color/accent"))?.valuesByMode ?? {})[0];

    expect(stored).toEqual({
      r: 0.9,
      g: 0.2,
      b: 0.1,
      a: 1,
    });
    expect(await apply(input)).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
    Object.assign(fake.figma.root, { documentColorProfile: "SRGB" });
  });

  it("takes an sRGB colour written into a P3 file as held once written, not as a change every time", async () => {
    Object.assign(fake.figma.root, { documentColorProfile: "DISPLAY_P3" });

    const input = {
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "color/alert",
              values: { Light: "#FF0000" },
            },
          ],
        },
      ],
    };

    await apply(input);
    expect(await apply(input)).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
    Object.assign(fake.figma.root, { documentColorProfile: "SRGB" });
  });

  it("points an alias at a variable made in the same call or the file's, whatever the order", async () => {
    const result = await apply({
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "color/link",
              values: {
                Light: "var(--color-accent)",
                Dark: "var(--color-primary)",
              },
            },
            {
              name: "color/accent",
              values: {
                Light: "#0D99FF",
                Dark: "#0D99FF",
              },
            },
          ],
        },
      ],
    });
    const link = await variableNamed("color/link");
    const accent = await variableNamed("color/accent");

    expect(result.errors).toEqual([]);
    expect(link?.resolvedType).toBe("COLOR");
    expect(link?.valuesByMode).toEqual({
      "M:light": {
        type: "VARIABLE_ALIAS",
        id: accent?.id,
      },
      "M:dark": {
        type: "VARIABLE_ALIAS",
        id: "V:primary",
      },
    });
  });

  it("refuses a value of another type than the variable's and an alias to nothing, writing the rest", async () => {
    const result = await apply({
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "color/primary",
              values: { Light: "16px" },
            },
            {
              name: "color/ghost",
              values: { Light: "var(--nope)" },
            },
            {
              name: "color/fine",
              values: { Light: "#FFF" },
            },
          ],
        },
      ],
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        kind: "variable",
        name: "color/primary",
        message: expect.stringMatching(/COLOR/),
      }),
      expect.objectContaining({
        kind: "variable",
        name: "color/ghost",
        message: expect.stringMatching(/--nope/),
      }),
    ]);
    expect(result.created).toEqual([
      {
        kind: "variable",
        collection: "Brand",
        name: "color/fine",
      },
    ]);
  });

  it("goes on when a mode cannot be added (the plan's limit), writing the other modes", async () => {
    const result = await apply({
      collections: [
        {
          name: "Brand",
          modes: ["Light", "Dark", "Contrast"],
          variables: [
            {
              name: "color/primary",
              values: {
                Light: "#111111",
                Contrast: "#FFFF00",
              },
            },
          ],
        },
      ],
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        kind: "mode",
        collection: "Brand",
        name: "Contrast",
        message: expect.stringMatching(/Limited/),
      }),
    ]);
    expect(result.updated).toEqual([
      {
        kind: "variable",
        collection: "Brand",
        name: "color/primary",
      },
    ]);
  });

  it("leaves a library's collection alone: the same values change nothing, others are refused", async () => {
    const same = await apply({
      collections: [
        {
          name: "Library colors",
          variables: [
            {
              name: "Green",
              values: { Value: "#00FF00" },
            },
          ],
        },
      ],
    });
    const other = await apply({
      collections: [
        {
          name: "Library colors",
          variables: [
            {
              name: "Green",
              values: { Value: "#00AA00" },
            },
          ],
        },
      ],
    });

    expect(same).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
    expect(other.errors).toEqual([
      expect.objectContaining({
        name: "Green",
        collection: "Library colors",
        message: expect.stringMatching(/library/),
      }),
    ]);
    expect((await store()).collections.map(({ name }) => name)).toEqual(["Brand", "Theme"]);
  });

  it("checks without writing on a dry run, which needs no Allow edits; a real run does", async () => {
    plugin.services.edits.allow(false);

    const checked = await apply(
      {
        collections: [
          {
            name: "Space",
            variables: [
              {
                name: "s",
                values: { Mobile: "8px" },
              },
            ],
          },
        ],
      },
      true,
    );

    expect(checked.created).toEqual([
      {
        kind: "collection",
        name: "Space",
      },
      {
        kind: "mode",
        collection: "Space",
        name: "Mobile",
      },
      {
        kind: "variable",
        collection: "Space",
        name: "s",
      },
    ]);
    expect((await store()).collections.map(({ name }) => name)).toEqual(["Brand", "Theme"]);
    expect(fake.writes.undo).toBe(0);
    await expect(
      apply({
        collections: [
          {
            name: "Space",
            variables: [],
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "EDITS_DISABLED",
    });
  });

  it("writes a token other than the name's own as the variable's WEB code syntax", async () => {
    await apply({
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "Primary",
              token: "--brand-primary",
              values: { Light: "#000" },
            },
          ],
        },
      ],
    });

    expect((await variableNamed("Primary"))?.codeSyntax).toEqual({ WEB: "var(--brand-primary)" });
  });
});
