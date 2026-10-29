import {
  type ComponentValue,
  isFunctionNode,
  isTokenNode,
  replaceComponentValues,
  stringify,
} from "@csstools/css-parser-algorithms";
import { isTokenBadURL, isTokenString, isTokenURL } from "@csstools/css-tokenizer";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { URL_PATTERN, URL_TEXT, URL_VALUE } from "@/core/css/values/values.constants.ts";

/** The file a background layer names and what follows it (its position, size and repeat). */
interface UrlImage {
  readonly src: string;
  readonly rest: string;
}

/** A url() CSS cannot read, and how to write it. */
interface UrlRefusal {
  readonly error: string;
  readonly hint: string;
}

/** `url()` written and read (C-014), through the @csstools tokenizer, which tells a bad unquoted url from a good one. */
@injectable()
export class CssUrl {
  readonly #split;

  constructor(split = inject(CSS_SPLIT)) {
    this.#split = split;
  }

  /** A file's url(): bare where CSS reads it so, quoted when the path holds spaces, quotes, brackets or backslashes. */
  url(path: string): string {
    return URL_PATTERN.bare.test(path)
      ? URL_TEXT.bare(path)
      : URL_TEXT.quoted(path.replace(URL_PATTERN.escaped, URL_VALUE.escape));
  }

  /**
   * A background layer that starts with url(): its file and what follows; refused when the name has a space, a quote,
   * a bracket or var() without quotes (CSS's bad-url); null for any other layer.
   */
  image(layer: string): UrlImage | UrlRefusal | null {
    const [first, ...rest] = this.#split.components(layer.trim());
    const tail = () =>
      rest
        .map((node) => node.toString())
        .join("")
        .trim();

    if (first !== undefined && isTokenNode(first)) {
      if (isTokenURL(first.value)) {
        return { src: first.value[4].value, rest: tail() };
      }

      return isTokenBadURL(first.value) ? { error: URL_TEXT.unquoted(layer), hint: URL_TEXT.quote } : null;
    }

    const quoted = this.#quoted(first);

    return quoted === undefined ? null : { src: quoted, rest: tail() };
  }

  /** A value with every url() emptied, quoted or not: backgrounds compared without the file they name. */
  withoutUrls(value: string): string {
    const [nodes = []] = replaceComponentValues([this.#split.components(value)], (node) => {
      if (isTokenNode(node) && (isTokenURL(node.value) || isTokenBadURL(node.value))) {
        return this.#split.components(URL_VALUE.empty);
      }

      if (this.#isUrl(node)) {
        node.value = [];
      }

      return node;
    });

    return stringify([nodes]);
  }

  /** The quoted file of a url("...") function. */
  #quoted(node: ComponentValue | undefined): string | undefined {
    if (node === undefined || !this.#isUrl(node)) {
      return undefined;
    }

    for (const inner of node.value) {
      if (isTokenNode(inner) && isTokenString(inner.value)) {
        return inner.value[4].value;
      }
    }

    return undefined;
  }

  #isUrl(node: ComponentValue): node is Extract<ComponentValue, { getName(): string }> & { value: ComponentValue[] } {
    return isFunctionNode(node) && node.getName().toLowerCase() === URL_VALUE.name;
  }
}

export const CSS_URL = new InjectionToken<CssUrl>("CssUrl");
