import type { SnapshotVariable } from "../types/snapshot.ts";

/**
 * A style's or variable's CSS custom property, named the way Dev Mode names it: `Dark` → `--Dark`, `a/b c` → `--a-b-c`.
 * Letters and digits of any script stay (CSS allows them); a name with none gets a hash, so no two names share one.
 */
export function tokenName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned === "" ? `--token-${hash(name)}` : `--${cleaned}`;
}

/** FNV-1a, in base 36: short, stable, good enough to keep a few odd names apart. */
function hash(text: string): string {
  let value = 0x811c9dc5;

  for (const char of text) {
    value ^= char.codePointAt(0) ?? 0;
    value = Math.imul(value, 0x01000193) >>> 0;
  }

  return value.toString(36);
}

/** A variable's custom property: the WEB code syntax its designer gave it, else its name. */
export function variableTokenName(variable: SnapshotVariable): string {
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
