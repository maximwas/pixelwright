import {
  type ComponentValue,
  isTokenNode,
  isWhiteSpaceOrCommentNode,
  parseListOfComponentValues,
} from "@csstools/css-parser-algorithms";
import { isTokenComma, isTokenDelim, isTokenSemicolon, tokenize } from "@csstools/css-tokenizer";
import { InjectionToken, injectable } from "@needle-di/core";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";

type CssSeparator = (typeof CSS_SEPARATOR)[keyof typeof CSS_SEPARATOR];

/** CSS values as the @csstools tokenizer reads them (C-015): no regex splitter sees inside parentheses or quotes. */
@injectable()
export class CssSplit {
  /** A value's component values: functions with their arguments, strings, words, spaces and comments. */
  components(value: string): ComponentValue[] {
    return parseListOfComponentValues(tokenize({ css: value }));
  }

  /**
   * A value split where CSS sees the separator at its top level, never inside parentheses, quotes or comments:
   * "a(1, 2), 'b, c'" gives "a(1, 2)" and "'b, c'". Split at spaces, a comment counts as one.
   */
  split(value: string, separator: CssSeparator): string[] {
    const parts: ComponentValue[][] = [[]];

    for (const node of this.components(value)) {
      const splits =
        separator === CSS_SEPARATOR.space ? isWhiteSpaceOrCommentNode(node) : this.#separates(node, separator);

      if (splits) {
        parts.push([]);
      } else {
        parts.at(-1)?.push(node);
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

  #separates(node: ComponentValue, separator: CssSeparator): boolean {
    if (!isTokenNode(node)) {
      return false;
    }

    if (separator === CSS_SEPARATOR.comma) {
      return isTokenComma(node.value);
    }

    return separator === CSS_SEPARATOR.semicolon
      ? isTokenSemicolon(node.value)
      : isTokenDelim(node.value) && node.value[4].value === CSS_SEPARATOR.slash;
  }
}

export const CSS_SPLIT = new InjectionToken<CssSplit>("CssSplit");
