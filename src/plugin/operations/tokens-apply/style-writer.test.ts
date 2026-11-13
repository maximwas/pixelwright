import { describe, expect, it } from "vitest";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { FontWeight } from "@/core/kernel/names/font-weight.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { FontCatalog } from "@/plugin/adapters/figma/fonts/font-catalog.ts";
import { StyleLooks } from "@/plugin/operations/tokens-apply/style-looks.ts";
import { StyleWriter } from "@/plugin/operations/tokens-apply/style-writer.ts";
import { TextStyleLooks } from "@/plugin/operations/tokens-apply/text-style-looks.ts";
import type { TokenRun } from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { VariableValues } from "@/plugin/operations/tokens-apply/variable-values.ts";
import type { StylePlans } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

// No Figma here (CLAUDE.md): the factory is a stub that keeps the styles it makes; the live suite writes real ones.

type Held = { readonly id: string; readonly name: string; [field: string]: unknown };

type TextPlan = StylePlans["text"][number];

type Group = keyof StylePlans;

const NO_STYLES: StylePlans = { paint: [], text: [], effect: [] };

const PIXELS_24 = { unit: "PIXELS", value: 24 } as const;

/** A text style's CSS font as the plan carries it. */
function font(
  size: number,
  lineHeight: TextPlan["font"]["lineHeight"],
  weight = 400,
): TextPlan["font"] {
  return { family: "Inter", weight, italic: false, size, lineHeight };
}

/** A text style the file holds. */
function heldText(fields: Record<string, unknown>): Held {
  return {
    id: "S:held",
    name: "Body",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    lineHeight: PIXELS_24,
    ...fields,
  };
}

/**
 * The writer as the plugin's root builds it, over a stub factory: the styles it holds, the fonts Figma lists (the one
 * `unloadable` is refused when loaded), the variables it lists and the by-id lookups it was made to do.
 */
function build(held: Held[] = [], options: { unloadable?: string; refusing?: string; variables?: Held[] } = {}) {
  const styles: Record<Group, Held[]> = { paint: [], text: [...held], effect: [] };
  const loaded: unknown[] = [];
  const looked: string[] = [];
  const factory = {
    styles: async (group: Group) => styles[group],
    style: (group: Group, name: string) => {
      const made: Held = { id: `S:${styles[group].length}`, name };

      if (options.refusing !== undefined) {
        Object.defineProperty(made, options.refusing, {
          set: () => {
            throw new Error("refused");
          },
        });
      }

      styles[group].push(made);

      return made;
    },
    variables: async () => options.variables ?? [],
  };
  const fonts = ["Regular", "Bold", "Condensed Bold"].map((style) => ({ fontName: { family: "Inter", style } }));
  const layers = {
    fonts: async () => fonts,
    loadFont: async (fontName: { style: string }) => {
      if (fontName.style === options.unloadable) {
        throw new Error("The font is not installed.");
      }

      loaded.push(fontName);
    },
  };
  const paints = {
    colour: (color: unknown) => color,
    of: async (specs: { token?: string }[], bound: ReadonlyMap<string, { id: string }>) =>
      specs.map(({ token }) => ({ type: "SOLID", variable: bound.get(token ?? "")?.id })),
  };
  const effects = { merged: async (_held: unknown[], specs: unknown[]) => specs };
  const lookup = {
    variable: async (id: string) => {
      looked.push(id);

      return null;
    },
  };
  const values = new VariableValues(paints as never, factory as never, lookup as never, {} as never);
  const looks = new StyleLooks(paints as never, effects as never, values);
  const shorthand = new FontShorthand(new NumberFormat(), new FontWeight());
  const texts = new TextStyleLooks(new FontCatalog(layers as never), shorthand);
  const writer = new StyleWriter(factory as never, looks, texts, layers as never);
  const run: TokenRun = {
    dryRun: false,
    answer: { created: [], updated: [], errors: [], notes: [] },
    local: new Map(),
    made: new Map(),
    wrote: false,
  };

  return { writer, run, styles, loaded, looked };
}

describe("StyleWriter (C-173, T-166, P-163)", () => {
  it("makes no text style when its font will not load: its own error, nothing written, no undo step", async () => {
    const { writer, run, styles } = build([], { unloadable: "Bold" });

    await writer.write({ ...NO_STYLES, text: [{ name: "Caption", font: font(12, PIXELS_24, 700) }] }, {}, run);

    expect(styles.text).toEqual([]);
    expect(run.wrote).toBe(false);
    expect(run.answer.errors).toEqual([{ kind: "text", name: "Caption", message: "The font is not installed." }]);
  });

  it("counts a style it made as a write even when taking its value is refused, so one undo step closes it", async () => {
    const { writer, run, styles } = build([], { refusing: "effects" });

    await writer.write(
      {
        ...NO_STYLES,
        effect: [{ name: "Card", effects: [{ type: "DROP_SHADOW", radius: 8, x: 0, y: 2 }], covers: ["DROP_SHADOW"] }],
      },
      {},
      run,
    );

    expect(styles.effect).toHaveLength(1);
    expect(run.wrote).toBe(true);
    expect(run.answer.errors).toEqual([{ kind: "effect", name: "Card", message: "refused" }]);
  });

  it("keeps a held size that renders as the CSS says, as tokens_read rounds it: 17.123 stays for 17.12px", async () => {
    const { writer, run, styles } = build([heldText({ fontSize: 17.123 })]);

    await writer.write(
      { ...NO_STYLES, text: [{ name: "Body", id: "S:held", font: font(17.12, PIXELS_24), textCase: "UPPER" }] },
      {},
      run,
    );

    expect(styles.text[0]).toMatchObject({ fontSize: 17.123, textCase: "UPPER" });
  });

  it("keeps a percent line height that renders as the CSS's px at that size, and writes one that does not", async () => {
    const percent = { unit: "PERCENT", value: 150 };
    const { writer, run, styles } = build([
      heldText({ lineHeight: percent }),
      heldText({ id: "S:other", name: "Other", lineHeight: percent }),
    ]);

    await writer.write(
      {
        ...NO_STYLES,
        text: [
          { name: "Body", id: "S:held", font: font(16, PIXELS_24), textCase: "UPPER" },
          { name: "Other", id: "S:other", font: font(16, { unit: "PIXELS", value: 28 }) },
        ],
      },
      {},
      run,
    );

    expect(styles.text.map(({ lineHeight }) => lineHeight)).toEqual([percent, { unit: "PIXELS", value: 28 }]);
  });

  it("keeps a held face the font's weight and family still mean, loading that one: a condensed bold stays for 700", async () => {
    const condensed = { family: "Inter", style: "Condensed Bold" };
    const { writer, run, styles, loaded } = build([heldText({ fontName: condensed })]);

    await writer.write(
      { ...NO_STYLES, text: [{ name: "Body", id: "S:held", font: font(16, PIXELS_24, 700) }] },
      {},
      run,
    );

    expect(styles.text[0]?.fontName).toEqual(condensed);
    expect(loaded).toEqual([condensed]);
  });

  it("keeps a held letter spacing that renders as the CSS's em", async () => {
    const spacing = { unit: "PERCENT", value: 1.004 };
    const { writer, run, styles } = build([heldText({ letterSpacing: spacing })]);

    await writer.write(
      {
        ...NO_STYLES,
        text: [
          {
            name: "Body",
            id: "S:held",
            font: font(16, PIXELS_24),
            letterSpacing: { unit: "PERCENT", value: 1 },
            textCase: "UPPER",
          },
        ],
      },
      {},
      run,
    );

    expect(styles.text[0]).toMatchObject({ letterSpacing: spacing, textCase: "UPPER" });
  });

  it("finds a style's variable among the file's, listed once, never by an id lookup that can wait offline (P-070)", async () => {
    const { writer, run, styles, looked } = build([], { variables: [{ id: "V:ink", name: "Ink" }] });

    await writer.write(
      { ...NO_STYLES, paint: [{ name: "Fill", paints: [{ kind: "token", token: "--Ink" }] }] },
      { "--Ink": { id: "V:ink" } },
      run,
    );

    expect(run.answer.errors).toEqual([]);
    expect(styles.paint[0]).toMatchObject({ paints: [{ type: "SOLID", variable: "V:ink" }] });
    expect(looked).toEqual([]);
  });
});
