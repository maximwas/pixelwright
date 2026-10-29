import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FONT_SHORTHAND } from "@/core/css/fonts/font-shorthand.ts";
import { CASE_CSS, FONT_PATTERN } from "@/core/css/fonts/fonts.constants.ts";
import type { TextSegment } from "@/core/css/groups/text/text-run.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import type { PlannedAsset } from "@/core/design/assets/assets.types.ts";
import { READ_TOKENS } from "@/core/design/text/read-tokens.ts";
import { CATALOGUE_TEXT, TEXT_CONTENT } from "@/core/design/text/text.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** design_read's JSON beside the XML: its tokens, the text styles its texts name, the fonts they use, its assets. */
export interface Catalogue {
  readonly tokens: Record<string, string>;
  readonly textStyles: Record<string, string>;
  readonly fonts: Record<string, string[]>;
  readonly assets: readonly PlannedAsset[];
}

type Style = ReadModel["styles"][string];

/**
 * The text styles and fonts a read refers to (C-123): each text style by name as its font shorthand with its spacing
 * and case, sorted by name; each family with its weights (italic said) in numeric order. Hidden texts are stubs: left out.
 */
@injectable()
export class ReadCatalogue {
  readonly #fonts;
  readonly #names;
  readonly #tokens;
  readonly #assets;

  constructor(
    fonts = inject(FONT_SHORTHAND),
    names = inject(TOKEN_NAMES),
    tokens = inject(READ_TOKENS),
    assets = inject(ASSET_PLANNER),
  ) {
    this.#fonts = fonts;
    this.#names = names;
    this.#tokens = tokens;
    this.#assets = assets;
  }

  read(model: ReadModel): Catalogue {
    const styles = new Map<string, string>();
    const fonts = new Map<string, Set<string>>();

    for (const segment of this.#segments(model.root)) {
      const style = model.styles[segment.textStyleId];
      const css = style === undefined ? null : this.#style(style);
      const weights = fonts.get(segment.fontName.family) ?? new Set<string>();

      if (style !== undefined && css !== null) {
        styles.set(this.#names.styleName(style), css);
      }

      weights.add(CATALOGUE_TEXT.weight(segment.fontWeight, FONT_PATTERN.italic.test(segment.fontName.style)));
      fonts.set(segment.fontName.family, weights);
    }

    return {
      tokens: this.#tokens.read(model),
      textStyles: Object.fromEntries([...styles].sort(([first], [second]) => first.localeCompare(second))),
      fonts: Object.fromEntries(
        [...fonts].map(([family, weights]) => [
          family,
          [...weights].sort((first, second) => first.localeCompare(second, TEXT_CONTENT.locale, { numeric: true })),
        ]),
      ),
      assets: this.#assets.plan(model).assets(),
    };
  }

  /** The runs of every text the read writes in full: a hidden layer is a stub without its children. */
  #segments(layer: ReadLayer): TextSegment[] {
    return layer.visible
      ? [...(layer.text?.segments ?? []), ...(layer.children ?? []).flatMap((child) => this.#segments(child))]
      : [];
  }

  /** A text style as its font shorthand, then its letter spacing and case when not the default. */
  #style(style: Style): string | null {
    const { fontName, fontSize, lineHeight } = style;

    if (
      style.type !== TEXT_CONTENT.textStyleType ||
      fontName === undefined ||
      fontSize === undefined ||
      lineHeight === undefined
    ) {
      return null;
    }

    const spacing = style.letterSpacing === undefined ? null : this.#fonts.letterSpacing(style.letterSpacing);
    const transform = CASE_CSS[style.textCase ?? ""];

    return [
      this.#fonts.font({ fontName, fontSize, lineHeight }),
      ...(spacing === null ? [] : [CATALOGUE_TEXT.declaration(CSS_PROPERTY.letterSpacing, spacing)]),
      ...(transform === undefined ? [] : [CATALOGUE_TEXT.declaration(CSS_PROPERTY.textTransform, transform)]),
    ].join(TEXT_CONTENT.declarations);
  }
}

export const READ_CATALOGUE = new InjectionToken<ReadCatalogue>("ReadCatalogue");
