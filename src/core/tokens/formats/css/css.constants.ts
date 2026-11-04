/** The style groups in :root, in this order, each under its comment (T-160). */
export const CSS_STYLE_GROUPS = [
  ["Paint styles", "paint"],
  ["Effect styles", "effect"],
  ["Text styles: font: var(--name-font)", "text"],
] as const;

export const TOKENS_CSS_VALUE = { root: ":root", fallback: "initial" } as const;

export const TOKENS_CSS_TEXT = {
  declaration: (token: string, value: string) => `  ${token}: ${value};`,
  comment: (text: string) => `  /* ${text} */`,
  block: (selector: string, lines: readonly string[]) => `${selector} {\n${lines.join("\n")}\n}`,
  sheet: (blocks: readonly string[]) => `${blocks.join("\n\n")}\n`,
} as const;
