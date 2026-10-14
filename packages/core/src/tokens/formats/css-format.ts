import { modelSummary } from "../model/model-summary.ts";
import type { StyleToken, TokenModel } from "../model/types.ts";
import type { TokenFormat } from "./types.ts";

const INDENT = "  ";

/** The style groups in :root, in this order, each under its comment. */
const STYLE_GROUPS = [
  ["Paint styles", "paint"],
  ["Effect styles", "effect"],
  ["Text styles: font: var(--name-font)", "text"],
] as const;

/** Ready CSS custom properties, with a summary of what they hold. */
export const CSS_FORMAT: TokenFormat = {
  write: ({ model }) => {
    const css = tokensCss(model);

    return {
      body: {
        css,
        summary: modelSummary(model),
      },
      notes: [],
      size: css.length,
    };
  },
};

/**
 * The tokens as CSS: `:root` with every collection's default mode and the styles, then one block per other mode,
 * `[data-<collection>="<mode>"]`, holding that collection's variables in it. Put the attribute on the element a theme
 * applies to (html for the whole page).
 */
export function tokensCss(model: TokenModel): string {
  const root = [...defaultModeLines(model), ...styleLines(model)];

  return `${[`:root {\n${root.join("\n")}\n}`, ...modeBlocks(model)].join("\n\n")}\n`;
}

/** Every collection's variables in its default mode, under the collection's name. */
function defaultModeLines(model: TokenModel): string[] {
  return model.collections
    .filter((collection) => collection.variables.length > 0)
    .flatMap((collection) => [
      `${INDENT}/* ${collection.name} */`,
      ...collection.variables.map((variable) => declaration(variable.token, variable.values[collection.defaultMode])),
    ]);
}

/** The styles, a group per kind, a text style's extras after its font. */
function styleLines(model: TokenModel): string[] {
  return STYLE_GROUPS.flatMap(([title, kind]) => {
    const styles: readonly StyleToken[] = model.styles[kind];

    return styles.length === 0
      ? []
      : [
          `${INDENT}/* ${title} */`,
          ...styles.flatMap((style) => [
            declaration(style.token, style.value),
            ...(style.also ?? []).map((extra) => declaration(extra.token, extra.value)),
          ]),
        ];
  });
}

/** A block per collection mode but the default, under the mode's selector. */
function modeBlocks(model: TokenModel): string[] {
  return model.collections.flatMap((collection) =>
    collection.modes
      .filter((mode) => mode !== collection.defaultMode)
      .flatMap((mode) => {
        const lines = collection.variables.map((variable) => declaration(variable.token, variable.values[mode]));
        const selector = collection.selectors[mode];

        return lines.length === 0 || selector === undefined ? [] : [`${selector} {\n${lines.join("\n")}\n}`];
      }),
  );
}

function declaration(token: string, value: string | undefined): string {
  return `${INDENT}${token}: ${value ?? "initial"};`;
}
