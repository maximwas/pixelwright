import { TokensApplyInputSchema, tokensPlan } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

interface Applied {
  created: { kind: string; name: string }[];
  updated: { kind: string; name: string }[];
  errors: { kind: string; name: string; message: string }[];
}

const solid = (r: number, g: number, b: number) => ({
  type: "SOLID",
  visible: true,
  opacity: 1,
  blendMode: "NORMAL",
  color: {
    r,
    g,
    b,
  },
});

const apply = async (styles: unknown) => {
  const { plan, errors } = tokensPlan(TokensApplyInputSchema.parse({ styles }));

  expect(errors).toEqual([]);

  return (await plugin.run("tokens_apply", {
    plan,
    dryRun: false,
  })) as Applied;
};

let fake: ReturnType<typeof installFigma>;
const local = async () => ({
  paint: await figma.getLocalPaintStylesAsync(),
  text: await figma.getLocalTextStylesAsync(),
  effect: await figma.getLocalEffectStylesAsync(),
});

beforeEach(() => {
  fake = installFigma(
    tree({
      id: "0:1",
      type: "PAGE",
      children: [
        {
          id: "1:1",
          name: "Swatch",
          fillStyleId: "S:green",
        },
      ],
    }),
    {
      fonts: [
        {
          family: "Inter",
          style: "Regular",
        },
        {
          family: "Inter",
          style: "Medium",
        },
      ],
      localStyles: {
        paint: [
          {
            id: "S:dark",
            type: "PAINT",
            name: "Dark",
            remote: false,
            paints: [solid(0, 0, 0)],
          },
        ],
        text: [
          {
            id: "S:h2",
            type: "TEXT",
            name: "h2",
            remote: false,
            fontName: {
              family: "Inter",
              style: "Regular",
            },
            fontSize: 40,
            lineHeight: { unit: "AUTO" },
            letterSpacing: {
              unit: "PERCENT",
              value: 0,
            },
            textCase: "ORIGINAL",
            textDecoration: "NONE",
          },
        ],
        effect: [],
      },
      // A library's colour style the page uses.
      styles: {
        "S:green": {
          id: "S:green",
          type: "PAINT",
          name: "Green",
          remote: true,
          paints: [solid(0, 1, 0)],
        },
      },
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
            "M:light": {
              r: 0,
              g: 0.6,
              b: 1,
              a: 1,
            },
          },
        },
      ],
    },
  );
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("tokens_apply: styles", () => {
  it("makes the styles the file lacks and changes those that differ, leaving equal ones", async () => {
    const result = await apply({
      paint: [
        {
          name: "Dark",
          value: "#000000",
        },
        {
          name: "Brand",
          value: "#0D99FF",
        },
      ],
      text: [
        {
          name: "h2",
          value: "500 40px/normal 'Inter'",
        },
      ],
      effect: [
        {
          name: "Lift",
          value: "0 5px 0 0 #191A23",
        },
      ],
    });
    const styles = await local();

    expect(result).toEqual({
      created: [
        {
          kind: "paint",
          name: "Brand",
        },
        {
          kind: "effect",
          name: "Lift",
        },
      ],
      updated: [
        {
          kind: "text",
          name: "h2",
        },
      ],
      errors: [],
    });
    expect(styles.paint.find(({ name }) => name === "Brand")?.paints).toMatchObject([
      {
        type: "SOLID",
        color: {
          r: 13 / 255,
          g: 153 / 255,
          b: 1,
        },
      },
    ]);
    expect(styles.text[0]?.fontName).toEqual({
      family: "Inter",
      style: "Medium",
    });
    expect(styles.effect[0]?.effects).toMatchObject([
      {
        type: "DROP_SHADOW",
        offset: {
          x: 0,
          y: 5,
        },
      },
    ]);
    expect(fake.writes.undo).toBe(1);
    expect(
      await apply({
        paint: [
          {
            name: "Brand",
            value: "#0D99FF",
          },
        ],
        text: [
          {
            name: "h2",
            value: "500 40px/normal 'Inter'",
          },
        ],
        effect: [
          {
            name: "Lift",
            value: "0 5px 0 0 #191A23",
          },
        ],
      }),
    ).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
  });

  it("binds a paint style to a colour variable", async () => {
    await apply({
      paint: [
        {
          name: "Link",
          value: "var(--color-primary)",
        },
      ],
    });

    expect((await local()).paint.find(({ name }) => name === "Link")?.paints).toMatchObject([
      {
        boundVariables: {
          color: {
            type: "VARIABLE_ALIAS",
            id: "V:primary",
          },
        },
      },
    ]);
  });

  it("makes a gradient paint style, and leaves it when the same gradient comes again", async () => {
    const glow = {
      paint: [
        {
          name: "Glow",
          value: "linear-gradient(135deg, #3B2FD9 0%, #8B5CF6 100%)",
        },
      ],
    };

    await apply(glow);

    const made = (await local()).paint.find(({ name }) => name === "Glow");

    expect(made?.paints).toMatchObject([{ type: "GRADIENT_LINEAR" }]);
    expect(await apply(glow)).toMatchObject({
      created: [],
      updated: [],
    });

    await apply({
      paint: [
        {
          name: "Glow",
          value: "linear-gradient(135deg, #3B2FD9 0%, #000 100%)",
        },
      ],
    });

    expect((await local()).paint.find(({ name }) => name === "Glow")?.paints).toMatchObject([
      {
        gradientStops: [
          { position: 0 },
          {
            color: {
              r: 0,
              g: 0,
              b: 0,
            },
          },
        ],
      },
    ]);
  });

  it("leaves a library's style alone: the same value changes nothing, another is refused", async () => {
    expect(
      await apply({
        paint: [
          {
            name: "Green",
            value: "#00FF00",
          },
        ],
      }),
    ).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
    expect(
      (
        await apply({
          paint: [
            {
              name: "Green",
              value: "#00AA00",
            },
          ],
        })
      ).errors,
    ).toEqual([
      expect.objectContaining({
        kind: "paint",
        name: "Green",
        message: expect.stringMatching(/library/),
      }),
    ]);
    expect((await local()).paint.map(({ name }) => name)).toEqual(["Dark"]);
  });

  it("writes a text style's letter spacing and case, and leaves them when the same come again", async () => {
    const display = {
      text: [
        {
          name: "h2",
          value: "400 40px/normal 'Inter'",
          also: [
            {
              token: "--h2-letter-spacing",
              value: "-0.02em",
            },
            {
              token: "--h2-text-transform",
              value: "uppercase",
            },
          ],
        },
      ],
    };

    expect(await apply(display)).toMatchObject({ updated: [{ name: "h2" }] });
    expect((await local()).text[0]).toMatchObject({
      letterSpacing: {
        unit: "PERCENT",
        value: -2,
      },
      textCase: "UPPER",
    });
    // Figma keeps letter spacing as a float: what renders the same as asked is left alone.
    Object.assign((await local()).text[0] ?? {}, {
      letterSpacing: {
        unit: "PERCENT",
        value: -2.0000000298,
      },
    });
    expect(await apply(display)).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
    // A call that names no spacing or case leaves the style's.
    await apply({
      text: [
        {
          name: "h2",
          value: "500 40px/normal 'Inter'",
        },
      ],
    });
    expect((await local()).text[0]).toMatchObject({ textCase: "UPPER" });
  });

  it("makes a blur effect style, and adds a blur to a style's shadows keeping them", async () => {
    const backdrop = {
      effect: [
        {
          name: "Blur/Backdrop",
          value: "backdrop-filter: blur(17.2px)",
        },
      ],
    };

    expect(await apply(backdrop)).toMatchObject({ created: [{ name: "Blur/Backdrop" }] });
    expect((await local()).effect[0]?.effects).toMatchObject([
      {
        type: "BACKGROUND_BLUR",
        radius: 40,
      },
    ]);
    expect(await apply(backdrop)).toEqual({
      created: [],
      updated: [],
      errors: [],
    });

    await apply({
      effect: [
        {
          name: "Lift",
          value: "0 5px 0 0 #191A23",
        },
      ],
    });
    await apply({
      effect: [
        {
          name: "Lift",
          value: "filter: blur(2px)",
        },
      ],
    });

    expect((await local()).effect[1]?.effects.map(({ type }) => type).toSorted()).toEqual([
      "DROP_SHADOW",
      "LAYER_BLUR",
    ]);
  });

  it("names the font a text style asks for that this Figma lacks", async () => {
    expect(
      (
        await apply({
          text: [
            {
              name: "Body",
              value: "400 16px/24px 'Nope Sans'",
            },
          ],
        })
      ).errors,
    ).toEqual([
      expect.objectContaining({
        kind: "text",
        name: "Body",
        message: expect.stringMatching(/Nope Sans/),
      }),
    ]);
  });

  it("runs a retry after the call still writing, so it finds that call's styles by name and makes no copies", async () => {
    const load = fake.figma.loadFontAsync;

    // Fonts load slowly, as in the big call the server stopped waiting for: its retry arrives while it still writes.
    Object.assign(fake.figma, {
      loadFontAsync: async (font: FontName) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        await load(font);
      },
    });

    const text = ["h3", "h4", "h5"].map((name) => ({
      name,
      value: "500 20px/normal 'Inter'",
    }));
    const [first, retry] = await Promise.all([apply({ text }), apply({ text })]);

    expect((await local()).text.map(({ name }) => name)).toEqual(["h2", "h3", "h4", "h5"]);
    expect(first.created).toHaveLength(3);
    expect(retry).toEqual({
      created: [],
      updated: [],
      errors: [],
    });
  });
});
