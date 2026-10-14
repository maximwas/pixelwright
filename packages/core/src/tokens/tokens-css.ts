import type { TokenModel } from "./model/types.ts";

const INDENT = "  ";

/**
 * The tokens as CSS: `:root` with every collection's default mode and the styles, then one block per other mode,
 * `[data-<collection>="<mode>"]`, holding that collection's variables in it. Put the attribute on the element a theme
 * applies to (html for the whole page).
 */
export function tokensCss(model: TokenModel): string {
  const root: string[] = [];

  for (const collection of model.collections) {
    if (collection.variables.length > 0) {
      root.push(`${INDENT}/* ${collection.name} */`);
      root.push(
        ...collection.variables.map((variable) => declaration(variable.token, variable.values[collection.defaultMode])),
      );
    }
  }

  const styleGroups: [string, TokenModel["styles"]["paint"]][] = [
    ["Paint styles", model.styles.paint],
    ["Effect styles", model.styles.effect],
    ["Text styles: font: var(--name-font)", model.styles.text],
  ];

  for (const [title, styles] of styleGroups) {
    if (styles.length > 0) {
      root.push(`${INDENT}/* ${title} */`);
      root.push(
        ...styles.flatMap((style) => [
          declaration(style.token, style.value),
          ...(style.also ?? []).map((extra) => declaration(extra.token, extra.value)),
        ]),
      );
    }
  }

  const blocks = [`:root {\n${root.join("\n")}\n}`];

  for (const collection of model.collections) {
    for (const mode of collection.modes.filter((name) => name !== collection.defaultMode)) {
      const lines = collection.variables.map((variable) => declaration(variable.token, variable.values[mode]));
      const selector = collection.selectors[mode];

      if (lines.length > 0 && selector !== undefined) {
        blocks.push(`${selector} {\n${lines.join("\n")}\n}`);
      }
    }
  }

  return `${blocks.join("\n\n")}\n`;
}

function declaration(token: string, value: string | undefined): string {
  return `${INDENT}${token}: ${value ?? "initial"};`;
}
