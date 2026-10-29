import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { SOLID_PAINT } from "@/core/css/paints/solid-paint.ts";
import { HINT_FIGMA, HINT_LABEL, HINT_TEXT, RAW_COLOR, VAR_USE } from "@/core/design/hints/hints.constants.ts";
import type { Channels } from "@/core/kernel/color/color.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { XmlAttribute, XmlElement } from "@/core/xml/xml.types.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Tokens = Readonly<Record<string, string>>;

/**
 * What the read's tokens leave to the code (C-152): paint styles named without a value, numbered styles, raw colours a
 * token holds. Only CSS attributes are looked at: a colour in a text's characters, a name or a link is no CSS.
 */
@injectable()
export class TokenHints {
  readonly #names;
  readonly #solid;
  readonly #css: ReadonlySet<string> = new Set(Object.values(CSS_PROPERTY));

  constructor(names = inject(TOKEN_NAMES), solid = inject(SOLID_PAINT)) {
    this.#names = names;
    this.#solid = solid;
  }

  /** `tree`: the read as built; `tokens`: the JSON block's, by name. */
  read(
    model: ReadModel,
    tree: XmlElement | null,
    tokens: Tokens,
  ): string[] {
    const elements = this.#elements(tree);
    const values = elements.flatMap((element) => this.#attributes(element).map(([, value]) => value));

    return [
      ...this.#valueless(model, values, tokens),
      ...this.#numbered(model, values, tokens),
      ...this.#raw(model, elements),
    ];
  }

  /** Paint styles the XML names whose value no layer here could give: a var() the build cannot resolve on its own. */
  #valueless(
    model: ReadModel,
    values: readonly string[],
    tokens: Tokens,
  ): string[] {
    const missing = new Map<string, string>();

    for (const style of Object.values(model.styles)) {
      const name = this.#names.style(style);

      if (
        style.paints !== undefined &&
        tokens[name] === undefined &&
        values.some((value) => value.includes(HINT_LABEL.var(name)))
      ) {
        missing.set(
          name,
          style.paints.map((paint) => paint.type.toLowerCase()).join(HINT_TEXT.paints) || HINT_TEXT.empty,
        );
      }
    }

    return [...missing].map(([name, paints]) => HINT_TEXT.valueless(name, paints));
  }

  /** Each numbered style token the XML names (--White-2), with its value and the first one's: two styles, not one. */
  #numbered(
    model: ReadModel,
    values: readonly string[],
    tokens: Tokens,
  ): string[] {
    const hints = new Map<string, string>();

    for (const style of Object.values(model.styles)) {
      const name = this.#names.style(style);
      const used = values.some(
        (value) => value.includes(HINT_LABEL.var(name)) || value.includes(HINT_LABEL.varFallback(name)),
      );

      if (style.duplicate !== undefined && used) {
        const first = this.#names.style({ name: style.name });

        hints.set(name, HINT_TEXT.numbered(name, style, tokens[name], [first, tokens[first]]));
      }
    }

    return [...hints.values()];
  }

  /** A colour written raw in CSS that equals a style's or a variable's value, by the attribute and layer it is on. */
  #raw(model: ReadModel, elements: readonly XmlElement[]): string[] {
    const tokens = this.#colorTokens(model);
    const uses = new Map<string, string[]>();

    for (const element of elements) {
      for (const [property, value] of this.#attributes(element).filter(([name]) => this.#css.has(name))) {
        for (const [color] of value.replace(VAR_USE, "").matchAll(RAW_COLOR)) {
          if (tokens.has(color)) {
            uses.set(color, [...(uses.get(color) ?? []), HINT_LABEL.attribute(property, element.id)]);
          }
        }
      }
    }

    return [...uses].map(([color, places]) => HINT_TEXT.raw(color, places, tokens.get(color)));
  }

  /** The CSS of each colour a one-colour paint style or a colour variable holds, as design_read writes it, by token. */
  #colorTokens(model: ReadModel): Map<string, string> {
    const tokens = new Map<string, string>();

    for (const style of Object.values(model.styles)) {
      const [paint, ...rest] = style.paints ?? [];

      if (rest.length === 0 && paint?.type === HINT_FIGMA.solid && paint.color !== undefined) {
        tokens.set(this.#solid.color(paint.color, undefined, paint.opacity ?? 1, model), this.#names.style(style));
      }
    }

    for (const variable of Object.values(model.variables)) {
      const { value } = variable;

      if (variable.resolvedType === HINT_FIGMA.color && typeof value === "object" && value !== null && "r" in value) {
        tokens.set(this.#solid.color(value as Channels, undefined, 1, model), this.#names.variable(variable));
      }
    }

    return tokens;
  }

  /** An element's attributes, then its spans': a run's are its text's. */
  #attributes(element: XmlElement): XmlAttribute[] {
    const spans = (element.content ?? []).flatMap((piece) => (piece.kind === XML_CONTENT.span ? piece.attributes : []));

    return [...element.attributes, ...spans];
  }

  /** The tree's elements in document order. */
  #elements(element: XmlElement | null): XmlElement[] {
    return element === null ? [] : [element, ...element.children.flatMap((child) => this.#elements(child))];
  }
}

export const TOKEN_HINTS = new InjectionToken<TokenHints>("TokenHints");
