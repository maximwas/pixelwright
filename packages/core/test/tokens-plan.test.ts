import { describe, expect, it } from "vitest";
import { TokensApplyInputSchema, tokensPlan } from "../src/index.ts";

const planOf = (input: unknown) => tokensPlan(TokensApplyInputSchema.parse(input));

describe("tokensPlan: variables", () => {
  it("reads each mode's CSS value as tokens_read writes it, the type from the first value when none is given", () => {
    const { plan, errors } = planOf({
      collections: [
        {
          name: "Brand",
          modes: ["Light", "Dark"],
          defaultMode: "Light",
          selectors: { Dark: '[data-brand="dark"]' },
          variables: [
            {
              name: "color/primary",
              token: "--color-primary",
              type: "COLOR",
              values: {
                Light: "#0D99FF",
                Dark: "rgba(255, 0, 0, 0.5)",
              },
            },
            {
              name: "color/veil",
              values: {
                Light: "color-mix(in srgb, #FF0000 50%, transparent)",
                Dark: "transparent",
              },
            },
            {
              name: "space/m",
              values: { Light: "16px" },
            },
            {
              name: "opacity/muted",
              values: { Light: "0.5" },
            },
            {
              name: "font/body",
              values: { Light: "'Inter'" },
            },
            {
              name: "flag",
              values: { Light: "true" },
            },
            {
              name: "color/link",
              values: {
                Light: "var(--color-primary)",
                Dark: "var(--color-primary)",
              },
            },
          ],
        },
      ],
      notes: [],
    });
    const [collection] = plan.collections;
    const byName = new Map(collection?.variables.map((variable) => [variable.name, variable]));

    expect(errors).toEqual([]);
    expect(collection?.modes).toEqual(["Light", "Dark"]);
    expect(byName.get("color/primary")).toEqual({
      name: "color/primary",
      type: "COLOR",
      values: {
        Light: {
          kind: "color",
          color: {
            r: 13 / 255,
            g: 153 / 255,
            b: 1,
            a: 1,
          },
        },
        Dark: {
          kind: "color",
          color: {
            r: 1,
            g: 0,
            b: 0,
            a: 0.5,
          },
        },
      },
    });
    expect(byName.get("color/veil")?.values).toEqual({
      Light: {
        kind: "color",
        color: {
          r: 1,
          g: 0,
          b: 0,
          a: 0.5,
        },
      },
      Dark: {
        kind: "color",
        color: {
          r: 0,
          g: 0,
          b: 0,
          a: 0,
        },
      },
    });
    expect(
      ["space/m", "opacity/muted", "font/body", "flag"].map((name) => [
        byName.get(name)?.type,
        byName.get(name)?.values,
      ]),
    ).toEqual([
      [
        "FLOAT",
        {
          Light: {
            kind: "number",
            value: 16,
          },
        },
      ],
      [
        "FLOAT",
        {
          Light: {
            kind: "number",
            value: 0.5,
          },
        },
      ],
      [
        "STRING",
        {
          Light: {
            kind: "string",
            value: "Inter",
          },
        },
      ],
      [
        "BOOLEAN",
        {
          Light: {
            kind: "boolean",
            value: true,
          },
        },
      ],
    ]);
    expect(byName.get("color/link")).toEqual({
      name: "color/link",
      type: null,
      values: {
        Light: {
          kind: "alias",
          token: "--color-primary",
        },
        Dark: {
          kind: "alias",
          token: "--color-primary",
        },
      },
    });
  });

  it("keeps a token that is not the name's own as the variable's code syntax", () => {
    const { plan } = planOf({
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

    expect(plan.collections[0]?.variables[0]?.token).toBe("--brand-primary");
  });

  it("leaves a value tokens_read could only write as a comment as it is", () => {
    const { plan, errors } = planOf({
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "Ink",
              type: "COLOR",
              values: {
                Light: "/* unresolved alias VariableID:9:9 */",
                Dark: "#000",
              },
            },
          ],
        },
      ],
    });

    expect(errors).toEqual([]);
    expect(plan.collections[0]?.variables[0]?.values).toEqual({
      Dark: {
        kind: "color",
        color: {
          r: 0,
          g: 0,
          b: 0,
          a: 1,
        },
      },
    });
  });

  it("takes the modes from the values when the collection lists none", () => {
    const { plan } = planOf({
      collections: [
        {
          name: "Space",
          variables: [
            {
              name: "s",
              values: {
                Mobile: "8px",
                Desktop: "12px",
              },
            },
            {
              name: "m",
              values: {
                Desktop: "24px",
                Wide: "32px",
              },
            },
          ],
        },
      ],
    });

    expect(plan.collections[0]?.modes).toEqual(["Mobile", "Desktop", "Wide"]);
  });

  it("refuses a value its type cannot take and a type it cannot write, naming the variable and mode", () => {
    const { plan, errors } = planOf({
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "bad",
              type: "COLOR",
              values: { Light: "16px" },
            },
            {
              name: "motion",
              type: "EASING",
              values: { Light: "ease" },
            },
            {
              name: "fine",
              values: { Light: "#FFF" },
            },
          ],
        },
      ],
    });

    expect(errors).toEqual([
      {
        kind: "variable",
        collection: "Brand",
        name: "bad",
        mode: "Light",
        message: expect.stringMatching(/16px.*COLOR/),
      },
      {
        kind: "variable",
        collection: "Brand",
        name: "motion",
        message: expect.stringMatching(/EASING/),
      },
    ]);
    expect(plan.collections[0]?.variables.map(({ name }) => name)).toEqual(["fine"]);
  });

  it("takes a type in any case, as Figma's upper-case one", () => {
    const { plan, errors } = planOf({
      collections: [
        {
          name: "Brand",
          variables: [
            {
              name: "accent",
              type: "color",
              values: { Light: "#FFF" },
            },
          ],
        },
      ],
    });

    expect(errors).toEqual([]);
    expect(plan.collections[0]?.variables).toEqual([
      expect.objectContaining({
        name: "accent",
        type: "COLOR",
      }),
    ]);
  });
});

describe("tokensPlan: styles", () => {
  it("reads paint, text and effect styles as tokens_read writes them, by design_apply's rules", () => {
    const { plan, errors } = planOf({
      styles: {
        paint: [
          {
            name: "Dark",
            token: "--Dark",
            value: "#191A23",
          },
          {
            name: "Link",
            token: "--Link",
            value: "var(--color-primary)",
          },
        ],
        text: [
          {
            name: "h2",
            token: "--h2-font",
            value: "500 40px/normal 'Space Grotesk'",
          },
        ],
        effect: [
          {
            name: "Card",
            token: "--Card",
            value: "0 5px 0 0 #191A23, inset 0 0 0 1px #000",
          },
        ],
      },
    });

    expect(errors).toEqual([]);
    expect(plan.styles.paint).toEqual([
      {
        name: "Dark",
        paints: [
          {
            kind: "color",
            color: {
              r: 25 / 255,
              g: 26 / 255,
              b: 35 / 255,
              a: 1,
            },
          },
        ],
      },
      {
        name: "Link",
        paints: [
          {
            kind: "token",
            token: "--color-primary",
            opacity: 1,
          },
        ],
      },
    ]);
    expect(plan.styles.text).toEqual([
      {
        name: "h2",
        font: {
          family: "Space Grotesk",
          weight: 500,
          italic: false,
          size: 40,
          lineHeight: { unit: "AUTO" },
        },
      },
    ]);
    // In Figma's order, as design_apply writes a layer's: the last CSS shadow first.
    expect(plan.styles.effect[0]?.effects.map(({ type }) => type)).toEqual(["INNER_SHADOW", "DROP_SHADOW"]);
  });

  it("reads a text style's letter spacing and case from tokens_read's also, or after its font", () => {
    const { plan, errors } = planOf({
      styles: {
        text: [
          {
            name: "Display",
            token: "--Display-font",
            value: "700 48px/56px 'Inter'",
            also: [
              {
                token: "--Display-letter-spacing",
                value: "-0.02em",
              },
              {
                token: "--Display-text-transform",
                value: "uppercase",
              },
            ],
          },
          {
            name: "Caption",
            value: "400 12px/16px 'Inter'; letter-spacing: 0.4px",
          },
          {
            name: "Odd",
            value: "400 12px/16px 'Inter'; color: red",
          },
        ],
      },
    });

    expect(plan.styles.text).toEqual([
      expect.objectContaining({
        name: "Display",
        letterSpacing: {
          unit: "PERCENT",
          value: -2,
        },
        textCase: "UPPER",
      }),
      expect.objectContaining({
        name: "Caption",
        letterSpacing: {
          unit: "PIXELS",
          value: 0.4,
        },
      }),
    ]);
    expect(plan.styles.text[1]).not.toHaveProperty("textCase");
    expect(errors).toEqual([
      expect.objectContaining({
        kind: "text",
        name: "Odd",
        message: expect.stringMatching(/color: red/),
      }),
    ]);
  });

  it("reads an effect style's blurs after its shadows, and which effects its CSS names", () => {
    const { plan, errors } = planOf({
      styles: {
        effect: [
          {
            name: "Blur/Backdrop",
            value: "backdrop-filter: blur(20px)",
          },
          {
            name: "Glass",
            value: "0 1px 2px 0 #000; filter: blur(2px)",
          },
        ],
      },
    });

    expect(errors).toEqual([]);
    expect(plan.styles.effect).toEqual([
      {
        name: "Blur/Backdrop",
        effects: [
          {
            type: "BACKGROUND_BLUR",
            radius: 40,
          },
        ],
        covers: ["BACKGROUND_BLUR"],
      },
      {
        name: "Glass",
        effects: [
          {
            type: "LAYER_BLUR",
            radius: 4,
          },
          expect.objectContaining({ type: "DROP_SHADOW" }),
        ],
        covers: ["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR"],
      },
    ]);
  });

  it("refuses a style value that does not read as its kind, naming the style", () => {
    const { plan, errors } = planOf({
      styles: {
        paint: [
          {
            name: "Photo",
            value: "url(photo.png)",
          },
        ],
        text: [
          {
            name: "Huge",
            value: "huge",
          },
        ],
        effect: [
          {
            name: "Alias",
            value: "var(--Card)",
          },
        ],
      },
    });

    expect(errors.map(({ kind, name }) => [kind, name])).toEqual([
      ["paint", "Photo"],
      ["text", "Huge"],
      ["effect", "Alias"],
    ]);
    expect(plan.styles).toEqual({
      paint: [],
      text: [],
      effect: [],
    });
  });
});
