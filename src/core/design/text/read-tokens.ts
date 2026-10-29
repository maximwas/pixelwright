import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EFFECTS_GROUP } from "@/core/css/groups/effects/effects-group.ts";
import { PAINT_LIST } from "@/core/css/paints/paint-list.ts";
import type { Paint } from "@/core/css/paints/solid-paint.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { TOKEN_KIND } from "@/core/design/text/text.constants.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Variable = ReadModel["variables"][string];

type Style = ReadModel["styles"][string];

type PaintColor = NonNullable<Paint["color"]>;

/**
 * The JSON block's tokens (T-163): each variable and paint or effect style the read uses, by its token name, with its
 * value as design_read writes it (a number in px, a colour in the file's space, a style's paints or shadows), sorted
 * by name. A gradient or image paint style has no value without a layer's box: left out.
 */
@injectable()
export class ReadTokens {
  readonly #paints;
  readonly #lengths;
  readonly #effects;
  readonly #names;

  constructor(
    paints = inject(PAINT_LIST),
    lengths = inject(CSS_LENGTH),
    effects = inject(EFFECTS_GROUP),
    names = inject(TOKEN_NAMES),
  ) {
    this.#paints = paints;
    this.#lengths = lengths;
    this.#effects = effects;
    this.#names = names;
  }

  read(model: ReadModel): Record<string, string> {
    const tokens = new Map<string, string>();

    for (const variable of Object.values(model.variables)) {
      const value = this.#variable(variable, model);

      if (value !== null) {
        tokens.set(this.#names.variable(variable), value);
      }
    }

    for (const style of Object.values(model.styles)) {
      const value = this.#style(style, model);

      if (value !== null) {
        tokens.set(this.#names.style(style), value);
      }
    }

    return Object.fromEntries([...tokens].sort(([first], [second]) => first.localeCompare(second)));
  }

  #variable(variable: Variable, model: ReadModel): string | null {
    const { value } = variable;

    if (typeof value === "number") {
      return this.#lengths.px(value);
    }

    return variable.resolvedType === TOKEN_KIND.color && this.#isChannels(value) ? this.#color(value, model) : null;
  }

  #color(color: PaintColor, model: ReadModel): string | null {
    const css = this.#paints.css([{ type: TOKEN_KIND.solid, color }], undefined, model);

    return typeof css === "string" ? css : null;
  }

  #style(style: Style, model: ReadModel): string | null {
    if (style.type === TOKEN_KIND.paint) {
      const css = this.#paints.css(style.paints ?? [], undefined, model);

      return typeof css === "string" ? css : null;
    }

    const shadows = style.type === TOKEN_KIND.effect ? this.#effects.shadows(style.effects ?? [], false, model) : "";

    return shadows === "" ? null : shadows;
  }

  #isChannels(value: unknown): value is PaintColor {
    return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
  }
}

export const READ_TOKENS = new InjectionToken<ReadTokens>("ReadTokens");
