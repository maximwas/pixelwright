import type { SnapshotVariable } from "../types/snapshot.ts";

/** A style's or variable's CSS custom property, named the way Dev Mode names it: `Dark` → `--Dark`, `a/b c` → `--a-b-c`. */
export function tokenName(name: string): string {
  return `--${name
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
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
