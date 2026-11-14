import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DEFAULT_FONT_AXES, FIGMA_TEXT } from "@/core/css/groups/text/text.constants.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import type { TextLayer } from "@/plugin/adapters/figma/layer-factory.ts";
import { PAINTS } from "@/plugin/adapters/figma/paints.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND } from "@/plugin/operations/apply/apply.constants.ts";
import { APPLY_FONTS } from "@/plugin/operations/apply/apply-fonts.ts";
import { TOKEN_INDEX, type TokenPlace } from "@/plugin/operations/apply/token-index.ts";
import { PAINT_WRITE } from "@/plugin/operations/apply/writers/paint-write.ts";
import {
  TEXT_FIGMA,
  TEXT_RANGE_FIELD,
  type TEXT_RUN_FIELDS,
  WRITERS_TEXT,
} from "@/plugin/operations/apply/writers/writers.constants.ts";
import {
  INTENT_DECORATION,
  INTENT_DECORATION_STYLE,
  INTENT_KEY,
} from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A text's characters from start to end; an empty range is the whole of an empty text. */
export interface TextRange {
  readonly node: TextLayer;
  readonly start: number;
  readonly end: number;
}

export type RunKey = (typeof TEXT_RUN_FIELDS)[number][0];

/** A text field's setters, an entry of TEXT_RANGE_FIELD. */
export interface RangeEntry {
  readonly property?: string;
  readonly whole?: string;
  readonly range: string;
}

type Decoration = NonNullable<FigmaProps["textDecoration"]>;

/** A run property's refusal, found without writing. */
export interface RunRefusal {
  readonly key: RunKey;
  readonly error: unknown;
}

type Setter = (...values: unknown[]) => unknown;

/**
 * What a run of text sets over its characters (T-141, P-152): its text style, font, spacing, case, decoration, colour
 * and link. The fonts were found for the call (ApplyFonts) and the check refuses what is missing on dry and real runs
 * alike, so the write passes over a font or style the check already refused.
 */
@injectable()
export class TextRuns {
  readonly #fonts;
  readonly #tokens;
  readonly #paintWrite;
  readonly #paints;

  constructor(
    fonts = inject(APPLY_FONTS),
    tokens = inject(TOKEN_INDEX),
    paintWrite = inject(PAINT_WRITE),
    paints = inject(PAINTS),
  ) {
    this.#fonts = fonts;
    this.#tokens = tokens;
    this.#paintWrite = paintWrite;
    this.#paints = paints;
  }

  /**
   * What the props' font, axes, text style and colour refuse: an unknown family, axis, style or token. `families`: the
   * ones the axes go over.
   */
  async check(
    { font, fontVariations, textStyle, textFills }: FigmaProps,
    families: readonly string[] = [],
    place?: TokenPlace,
  ): Promise<RunRefusal[]> {
    const refusals: RunRefusal[] = [];
    const found = font === undefined ? undefined : this.#fonts.font(font);
    const axes =
      fontVariations === undefined
        ? undefined
        : families.map((family) => this.#fonts.variations(family, fontVariations)).find(Boolean);

    if (found instanceof WriteError) {
      refusals.push({ key: INTENT_KEY.font, error: found });
    }

    if (axes !== undefined) {
      refusals.push({ key: INTENT_KEY.fontVariations, error: axes });
    }

    if (
      textStyle !== undefined &&
      textStyle !== "" &&
      (await this.#tokens.style(textStyle, TOKEN_KIND.text)) === null
    ) {
      refusals.push({
        key: INTENT_KEY.textStyle,
        error: new WriteError(WRITERS_TEXT.noTextStyle(textStyle), WRITERS_TEXT.textStyleHint),
      });
    }

    if (textFills !== undefined) {
      await this.#paintWrite
        .check(textFills, place)
        .catch((error: unknown) => refusals.push({ key: INTENT_KEY.textFills, error }));
    }

    return refusals;
  }

  async write(
    key: RunKey,
    range: TextRange,
    props: FigmaProps,
  ): Promise<void> {
    const writers: Readonly<Record<RunKey, () => Promise<void>>> = {
      textStyle: async () => await this.#textStyle(range, props.textStyle),
      font: async () => await this.#font(range, props.font),
      fontVariations: async () => await this.#variations(range, props.fontVariations ?? {}),
      letterSpacing: async () => await this.set(range, TEXT_RANGE_FIELD.letterSpacing, { ...props.letterSpacing }),
      textCase: async () => await this.set(range, TEXT_RANGE_FIELD.textCase, props.textCase),
      textDecoration: async () => await this.#decoration(range, props.textDecoration),
      textFills: async () => await this.#fills(range, props.textFills ?? []),
      hyperlink: async () =>
        await this.set(
          range,
          TEXT_RANGE_FIELD.hyperlink,
          props.hyperlink === undefined || props.hyperlink === ""
            ? null
            : { type: TEXT_FIGMA.url, value: props.hyperlink },
        ),
    };

    if (props[key] !== undefined) {
      await writers[key]();
    }
  }

  /** A field over the range: the layer's own for an empty one, else its setRange method. */
  async set(
    { node, start, end }: TextRange,
    entry: RangeEntry,
    value: unknown,
  ): Promise<void> {
    if (start === end && entry.property !== undefined) {
      Reflect.set(node, entry.property, value);

      return;
    }

    const method = Reflect.get(node, start === end ? (entry.whole ?? entry.range) : entry.range) as Setter;

    await Reflect.apply(method, node, start === end ? [value] : [start, end, value]);
  }

  async #textStyle(range: TextRange, name: string | undefined): Promise<void> {
    const id = name === undefined || name === "" ? "" : await this.#tokens.style(name, TOKEN_KIND.text);

    if (id !== null) {
      await this.set(range, TEXT_RANGE_FIELD.textStyleId, id);
    }
  }

  /** The font and its size, and on a text its line height (a text on a path runs along its path, with no lines). */
  async #font(range: TextRange, spec: FigmaProps["font"]): Promise<void> {
    const font = spec === undefined ? undefined : this.#fonts.font(spec);

    if (spec === undefined || font === undefined || font instanceof WriteError) {
      return;
    }

    await this.set(range, TEXT_RANGE_FIELD.fontName, font);
    await this.set(range, TEXT_RANGE_FIELD.fontSize, spec.size);

    if (range.node.type === FIGMA_NODE_TYPE.text) {
      await this.set(range, TEXT_RANGE_FIELD.lineHeight, { ...spec.lineHeight });
    }
  }

  /**
   * The axes over each run's font, as CSS's font-variation-settings: the ones named, the weight and optical size its
   * font has, a browser's default for wdth, slnt and ital, and the named style's own for every other.
   */
  async #variations(range: TextRange, axes: Readonly<Record<string, number>>): Promise<void> {
    const { node, start, end } = range;
    const runs =
      start === end
        ? [{ start, end, fontName: node.fontName }]
        : node.getStyledTextSegments([TEXT_RANGE_FIELD.fontName.property], start, end);

    for (const run of runs) {
      if (typeof run.fontName === "object") {
        const { family, style, variationSettings = {} } = run.fontName;
        const kept = Object.entries(variationSettings).flatMap(([axis, value]) =>
          axis === FIGMA_TEXT.weightAxis || axis === FIGMA_TEXT.opticalSizeAxis
            ? [[axis, value]]
            : Object.hasOwn(DEFAULT_FONT_AXES, axis)
              ? [[axis, DEFAULT_FONT_AXES[axis]]]
              : [],
        );

        await this.set({ node, start: run.start, end: run.end }, TEXT_RANGE_FIELD.fontName, {
          family,
          style,
          variationSettings: { ...Object.fromEntries(kept), ...axes },
        });
      }
    }
  }

  /** The whole decoration, as the CSS shorthand resets it: no style is solid, no colour, offset or thickness Figma's own. */
  async #decoration(range: TextRange, decoration: Decoration | undefined): Promise<void> {
    if (decoration === undefined) {
      return;
    }

    await this.set(range, TEXT_RANGE_FIELD.textDecoration, decoration.line);

    if (decoration.line === INTENT_DECORATION.NONE) {
      return;
    }

    const color = decoration.color === undefined ? undefined : this.#paints.colour(decoration.color);
    const auto = { unit: TEXT_FIGMA.auto };

    await this.set(range, TEXT_RANGE_FIELD.textDecorationStyle, decoration.style ?? INTENT_DECORATION_STYLE.SOLID);
    await this.set(
      range,
      TEXT_RANGE_FIELD.textDecorationColor,
      color === undefined
        ? { value: TEXT_FIGMA.auto }
        : { value: { type: TEXT_FIGMA.solid, color: { r: color.r, g: color.g, b: color.b }, opacity: color.a } },
    );
    await this.set(range, TEXT_RANGE_FIELD.textDecorationOffset, { ...(decoration.offset ?? auto) });
    await this.set(range, TEXT_RANGE_FIELD.textDecorationThickness, { ...(decoration.thickness ?? auto) });
  }

  async #fills(range: TextRange, specs: NonNullable<FigmaProps["textFills"]>): Promise<void> {
    const paints = await this.#paintWrite.paints(specs, range.node);

    await (typeof paints === "string"
      ? this.set(range, TEXT_RANGE_FIELD.fillStyleId, paints)
      : this.set(range, TEXT_RANGE_FIELD.fills, paints));
  }
}

export const TEXT_RUNS = new InjectionToken<TextRuns>("TextRuns");
