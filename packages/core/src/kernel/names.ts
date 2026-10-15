import { fnv1a } from "./hash.ts";

/** A style as its name and its number among same-named styles of its kind (styleNumbers). */
interface NamedStyle {
  readonly name: string;
  readonly duplicate?: number | undefined;
}

/** A variable as its name and the names its designer gave it per platform. */
interface NamedVariable {
  readonly name: string;
  readonly codeSyntax?: Readonly<Record<string, string>> | undefined;
}

/**
 * A style's or variable's CSS custom property, named the way Dev Mode names it: `Dark` → `--Dark`, `a/b c` → `--a-b-c`.
 * Letters and digits of any script stay (CSS allows them); a name with none gets a hash, so no two names share one.
 */
export function tokenName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned === "" ? `--token-${fnv1a(name)}` : `--${cleaned}`;
}

/** A style's name as the XML writes it (textStyle): numbered like its token when another of its kind shares it (h1-2). */
export function styleName(style: NamedStyle): string {
  return style.duplicate === undefined ? style.name : `${style.name}-${style.duplicate}`;
}

/** A style's custom property: its name's, numbered when other styles of its kind share the name (--Black-2). */
export function styleTokenName(style: NamedStyle): string {
  const name = tokenName(style.name);

  return style.duplicate === undefined ? name : `${name}-${style.duplicate}`;
}

/** A variable's custom property: the WEB code syntax its designer gave it, else its name. */
export function variableTokenName(variable: NamedVariable): string {
  const web = variable.codeSyntax?.WEB?.trim();

  if (web === undefined || web === "") {
    return tokenName(variable.name);
  }

  const wrapped = /^var\(\s*(--[^,)\s]+)/.exec(web);

  if (wrapped?.[1] !== undefined) {
    return wrapped[1];
  }

  return web.startsWith("--") ? web : `--${web}`;
}
