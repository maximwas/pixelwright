import { InjectionToken, injectable } from "@needle-di/core";
import { CSS_STYLE_GROUPS, TOKENS_CSS_TEXT, TOKENS_CSS_VALUE } from "@/core/tokens/formats/css/css.constants.ts";
import type { ReadyTokens, StyleToken } from "@/core/tokens/model/model.schema.ts";

/**
 * The tokens as CSS (T-160): `:root` with every collection's default mode and the styles, then a block per mode of a
 * collection with several, under its selector `[data-<collection>="<mode>"]`, the default's first so an element of it
 * inside another mode's sets its values back. Put the attribute on the element a theme applies to (html for the
 * page); design_read writes it where a layer sets a mode.
 */
@injectable()
export class TokensCss {
  write(tokens: ReadyTokens): string {
    const root = [...this.#defaults(tokens), ...this.#styles(tokens)];

    return TOKENS_CSS_TEXT.sheet([TOKENS_CSS_TEXT.block(TOKENS_CSS_VALUE.root, root), ...this.#modes(tokens)]);
  }

  /** Every collection's variables in its default mode, under the collection's name. */
  #defaults(tokens: ReadyTokens): string[] {
    return tokens.collections
      .filter((collection) => collection.variables.length > 0)
      .flatMap((collection) => [
        TOKENS_CSS_TEXT.comment(collection.name),
        ...collection.variables.map((variable) =>
          this.#declaration(variable.token, variable.values[collection.defaultMode]),
        ),
      ]);
  }

  /** The styles, a group per kind, a style's other tokens after it. */
  #styles(tokens: ReadyTokens): string[] {
    return CSS_STYLE_GROUPS.flatMap(([title, group]) => {
      const styles: readonly StyleToken[] = tokens.styles[group];

      return styles.length === 0
        ? []
        : [
          TOKENS_CSS_TEXT.comment(title),
          ...styles.flatMap((style) => [
            this.#declaration(style.token, style.value),
            ...(style.also ?? []).map((extra) => this.#declaration(extra.token, extra.value)),
          ]),
        ];
    });
  }

  /** A block per mode of a collection with more than one, in its selectors' order (the default's first). */
  #modes(tokens: ReadyTokens): string[] {
    return tokens.collections.flatMap((collection) =>
      Object.entries(collection.selectors).flatMap(([mode, selector]) => {
        const lines = collection.variables.map((variable) => this.#declaration(variable.token, variable.values[mode]));

        return lines.length === 0 ? [] : [TOKENS_CSS_TEXT.block(selector, lines)];
      }),
    );
  }

  #declaration(token: string, value: string | undefined): string {
    return TOKENS_CSS_TEXT.declaration(token, value ?? TOKENS_CSS_VALUE.fallback);
  }
}

export const TOKENS_CSS = new InjectionToken<TokensCss>("TokensCss");
