import {
  type ComponentValue,
  isCommentNode,
  isFunctionNode,
  isTokenNode,
  isWhiteSpaceOrCommentNode,
  parseListOfComponentValues,
  replaceComponentValues,
  stringify,
  walk,
} from "@csstools/css-parser-algorithms";
import {
  isTokenBadURL,
  isTokenComma,
  isTokenDelim,
  isTokenString,
  isTokenURL,
  tokenize,
} from "@csstools/css-tokenizer";
import type { LengthValue, TokenRef } from "../figma-props.ts";

/** A value as CSS parses it: its component values (functions with their arguments, strings, words, spaces). */
function componentsOf(value: string): ComponentValue[] {
  return parseListOfComponentValues(tokenize({ css: value }));
}

/**
 * A value split at a separator CSS sees at its top level, never inside parentheses, quotes or comments:
 * "a(1, 2), 'b, c'" → ["a(1, 2)", "'b, c'"]. Split at spaces, a comment counts as one.
 */
export function splitTop(value: string, separator: "," | " " | "/"): string[] {
  const parts: ComponentValue[][] = [[]];

  for (const node of componentsOf(value)) {
    const splits =
      separator === " "
        ? isWhiteSpaceOrCommentNode(node)
        : isTokenNode(node) &&
          (separator === "," ? isTokenComma(node.value) : isTokenDelim(node.value) && node.value[4].value === "/");

    if (splits) {
      parts.push([]);
    } else {
      parts[parts.length - 1]?.push(node);
    }
  }

  return parts
    .map((part) =>
      part
        .map((node) => node.toString())
        .join("")
        .trim(),
    )
    .filter((part) => part !== "");
}

/**
 * A background layer that starts with url(): the file it names and what follows (its position, size and repeat);
 * "unquoted" when the name has spaces without quotes, which CSS cannot read; null for any other layer.
 */
export function imageOf(layer: string): { src: string; rest: string } | "unquoted" | null {
  const nodes = componentsOf(layer.trim());
  const [first, ...rest] = nodes;
  const tail = () =>
    rest
      .map((node) => node.toString())
      .join("")
      .trim();

  if (first !== undefined && isTokenNode(first)) {
    if (isTokenURL(first.value)) {
      return {
        src: first.value[4].value,
        rest: tail(),
      };
    }

    return isTokenBadURL(first.value) ? "unquoted" : null;
  }

  if (first !== undefined && isFunctionNode(first) && first.getName().toLowerCase() === "url") {
    const quoted = first.value.find((node) => isTokenNode(node) && isTokenString(node.value));

    return quoted !== undefined && isTokenNode(quoted) && isTokenString(quoted.value)
      ? {
          src: quoted.value[4].value,
          rest: tail(),
        }
      : null;
  }

  return null;
}

/** Every file a value names in url(), quoted or not, at any depth. */
export function urlsOf(value: string): string[] {
  const found: string[] = [];

  walk(componentsOf(value), ({ node }) => {
    if (isTokenNode(node) && isTokenURL(node.value)) {
      found.push(node.value[4].value);
    } else if (isFunctionNode(node) && node.getName().toLowerCase() === "url") {
      for (const inner of node.value) {
        if (isTokenNode(inner) && isTokenString(inner.value)) {
          found.push(inner.value[4].value);
        }
      }
    }
  });

  return found;
}

/** A value with every url() emptied, quoted or not: what it shows, whichever file it names. */
export function withoutUrls(value: string): string {
  const [nodes = []] = replaceComponentValues([componentsOf(value)], (node) => {
    if (isTokenNode(node) && (isTokenURL(node.value) || isTokenBadURL(node.value))) {
      return parseListOfComponentValues(tokenize({ css: "url()" }));
    }

    if (isFunctionNode(node) && node.getName().toLowerCase() === "url") {
      node.value = [];

      return node;
    }

    return undefined;
  });

  return stringify([nodes]);
}

/** A value without comments and with every var() cut to its name: what a var() falls back to is left out. */
export function withoutFallbacks(value: string): string {
  const [nodes = []] = replaceComponentValues([componentsOf(value)], (node) => {
    if (isCommentNode(node)) {
      return [];
    }

    if (isFunctionNode(node) && node.getName().toLowerCase() === "var") {
      const comma = node.value.findIndex((inner) => isTokenNode(inner) && isTokenComma(inner.value));

      if (comma !== -1) {
        node.value = node.value.slice(0, comma);

        while (node.value.length > 0 && isWhiteSpaceOrCommentNode(node.value[node.value.length - 1])) {
          node.value.pop();
        }
      }

      return node;
    }

    return undefined;
  });

  return stringify([nodes]).replace(/\s+/g, " ").trim();
}

/** `var(--name)` → its token name (a fallback after it is left out), else null. */
export function tokenOf(value: string): TokenRef | null {
  const match = /^var\(\s*(--[^,)\s]+)\s*(?:,.*)?\)$/s.exec(value.trim());

  return match?.[1] === undefined ? null : { token: match[1] };
}

/** A length in px ("12px", "0", "-1.5px") or a token; null when it is neither. */
export function lengthOf(value: string): LengthValue | null {
  const token = tokenOf(value);

  if (token !== null) {
    return token;
  }

  const match = /^(-?\d*\.?\d+)(px)?$/.exec(value.trim());

  return match === null || (match[2] === undefined && Number(match[1]) !== 0) ? null : Number(match[1]);
}

/** A plain number ("0.5"). */
export function numberOf(value: string): number | null {
  return /^-?\d*\.?\d+$/.test(value.trim()) ? Number(value) : null;
}

/** A percent ("50%") as its number. */
export function percentOf(value: string): number | null {
  const match = /^(-?\d*\.?\d+)%$/.exec(value.trim());

  return match === null ? null : Number(match[1]);
}

/** A CSS value without the `var(--name, …)` Figma may wrap around it: the fallback inside, else the value as given. */
export function unwrapVar(value: string | undefined): string | undefined {
  const match = /^var\(\s*--[^,()]+,\s*([\s\S]+)\)$/.exec(value?.trim() ?? "");

  return match?.[1]?.trim() ?? value;
}

/** A CSS box shorthand of 1 to 4 values, top (or top-left) first and clockwise. */
export function boxOf<T>(parts: readonly (T | null)[]): [T, T, T, T] | null {
  if (parts.length === 0 || parts.length > 4 || parts.includes(null)) {
    return null;
  }

  const [a, b = a, c = a, d = b] = parts as T[];

  return [a as T, b as T, c as T, d as T];
}
