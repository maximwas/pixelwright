import {
  type ComponentValue,
  type FunctionNode,
  isCommentNode,
  isFunctionNode,
  isTokenNode,
  isWhiteSpaceOrCommentNode,
  replaceComponentValues,
  stringify,
} from "@csstools/css-parser-algorithms";
import { isTokenComma } from "@csstools/css-tokenizer";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_PATTERN, CSS_VALUE } from "@/core/css/values/values.constants.ts";

/** A value that names a token: `var(--name)`. */
export interface TokenRef {
  readonly token: string;
}

/**
 * `var()` in CSS values (C-017): Figma wraps a style as `var(--Name, fallback)`; design_read writes the bare var, and a
 * token's value goes in where one is known, a token that names itself staying a var().
 */
@injectable()
export class CssVar {
  readonly #split;

  constructor(split = inject(CSS_SPLIT)) {
    this.#split = split;
  }

  /** `var(--name)` as its token's name (a fallback after it left out), else null. */
  token(value: string): TokenRef | null {
    const name = CSS_PATTERN.token.exec(value.trim())?.[1];

    return name === undefined ? null : { token: name };
  }

  /** A value without comments and with every var() cut to its name. */
  withoutFallbacks(value: string): string {
    const [nodes = []] = replaceComponentValues([this.#split.components(value)], (node) => {
      if (isCommentNode(node)) {
        return [];
      }

      if (this.#isVar(node)) {
        const comma = this.#comma(node);
        const name = comma === -1 ? [...node.value] : node.value.slice(0, comma);

        for (let last = name.at(-1); last !== undefined && isWhiteSpaceOrCommentNode(last); last = name.at(-1)) {
          name.pop();
        }

        node.value = name;

        return node;
      }

      return undefined;
    });

    return stringify([nodes]).replace(CSS_PATTERN.spaces, CSS_VALUE.space).trim();
  }

  /** A value with each var() replaced by its token's value, else by its fallback, else kept. */
  resolved(value: string, tokens: Readonly<Record<string, string>>): string {
    return value.includes(CSS_VALUE.varOpen) ? this.#resolve(value, tokens, new Set()).trim() : value;
  }

  /** `chain`: the tokens on the way here, which are not replaced again, so a token that names itself stays a var(). */
  #resolve(
    css: string,
    tokens: Readonly<Record<string, string>>,
    chain: ReadonlySet<string>,
  ): string {
    const [nodes = []] = replaceComponentValues([this.#split.components(css)], (node) => {
      if (!this.#isVar(node)) {
        return undefined;
      }

      const comma = this.#comma(node);
      const name = stringify([comma === -1 ? node.value : node.value.slice(0, comma)]).trim();
      const fallback = comma === -1 ? undefined : stringify([node.value.slice(comma + 1)]).trim();
      const given = (chain.has(name) ? undefined : tokens[name]) ?? fallback;

      return given === undefined
        ? undefined
        : this.#split.components(this.#resolve(given, tokens, new Set([...chain, name])));
    });

    return stringify([nodes]);
  }

  #isVar(node: ComponentValue): node is FunctionNode {
    return isFunctionNode(node) && node.getName().toLowerCase() === CSS_VALUE.var;
  }

  #comma(node: FunctionNode): number {
    return node.value.findIndex((inner) => isTokenNode(inner) && isTokenComma(inner.value));
  }
}

export const CSS_VAR = new InjectionToken<CssVar>("CssVar");
