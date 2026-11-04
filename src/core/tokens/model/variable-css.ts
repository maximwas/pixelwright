import { InjectionToken, inject, injectable } from "@needle-di/core";
import { SOLID_PAINT } from "@/core/css/paints/solid-paint.ts";
import { EASING_CSS, type FigmaEasing } from "@/core/kernel/easing/easing-css.ts";
import { TOKEN_TEXT } from "@/core/kernel/names/names.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import {
  MODEL_NOTE,
  MODEL_NUMBER,
  MODEL_TEXT,
  MODEL_VALUE,
  NUMBER_UNIT,
  VARIABLE_TYPE,
} from "@/core/tokens/model/model.constants.ts";
import { NUMBER_UNITS, type NumberUnit } from "@/core/tokens/model/number-units.ts";
import type { RawVariable } from "@/shared/ops/variables/variables.schema.ts";
import type { ModelTables } from "@/shared/read-model/read-model.schema.ts";

/** What writing a variable's values needs: the colour profile and variables, each alias's CSS name, units, notes. */
export interface VariableContext {
  readonly tables: ModelTables;
  readonly names: ReadonlyMap<string, string>;
  readonly units: ReadonlyMap<string, NumberUnit>;
  readonly notes: Set<string>;
}

/**
 * A variable's value in one mode as CSS (T-164): an alias as var(--target); a colour in the file's space (rgba when
 * see-through), a composed one as color-mix(); a number in px, as a plain number or as an opacity by its unit (K-003);
 * a string quoted; a boolean as true or false; an easing as CSS's; a duration in seconds. What CSS cannot hold, and a
 * dead alias, is a comment with a note.
 */
@injectable()
export class VariableCss {
  readonly #solid;
  readonly #easing;
  readonly #format;
  readonly #units;

  constructor(
    solid = inject(SOLID_PAINT),
    easing = inject(EASING_CSS),
    format = inject(NUMBER_FORMAT),
    units = inject(NUMBER_UNITS),
  ) {
    this.#solid = solid;
    this.#easing = easing;
    this.#format = format;
    this.#units = units;
  }

  css(
    value: unknown,
    variable: RawVariable,
    context: VariableContext,
  ): string {
    const alias = this.#units.alias(value);

    if (alias !== null) {
      return this.#alias(alias, variable, context);
    }

    const css = this.#typed(value, variable, context);

    if (css !== null) {
      return css;
    }

    const shown = JSON.stringify(value);

    context.notes.add(MODEL_NOTE.unknown(variable.name, variable.resolvedType, shown));

    return MODEL_TEXT.comment(shown);
  }

  #typed(
    value: unknown,
    variable: RawVariable,
    context: VariableContext,
  ): string | null {
    switch (variable.resolvedType) {
      case VARIABLE_TYPE.color:
        return this.#color(value, variable, context);
      case VARIABLE_TYPE.float:
        return typeof value === "number" ? this.#number(value, context.units.get(variable.id) ?? NUMBER_UNIT.px) : null;
      case VARIABLE_TYPE.string:
        return typeof value === "string" ? MODEL_TEXT.quoted(value) : null;
      case VARIABLE_TYPE.boolean:
        context.notes.add(MODEL_NOTE.boolean(variable.name));

        return String(value);
      case VARIABLE_TYPE.easing:
        return this.#isEasing(value) ? this.#easing.css(value) : null;
      case VARIABLE_TYPE.timing:
        return typeof value === "number" ? MODEL_TEXT.seconds(this.#decimal(value)) : null;
      default:
        return null;
    }
  }

  #alias(
    id: string,
    variable: RawVariable,
    context: VariableContext,
  ): string {
    const target = context.names.get(id);

    if (target === undefined) {
      context.notes.add(MODEL_NOTE.unresolved(variable.name, id));

      return MODEL_TEXT.unresolved(id);
    }

    return TOKEN_TEXT.reference(target);
  }

  /** A colour, or a composed one: a colour and an opacity, either of them a variable. */
  #color(
    value: unknown,
    variable: RawVariable,
    context: VariableContext,
  ): string | null {
    const channels = this.#units.channels(value);

    if (channels !== null) {
      return this.#solid.color(channels, undefined, MODEL_NUMBER.fraction, context.tables);
    }

    const composed = this.#units.composed(value);

    if (composed === null) {
      return null;
    }

    const own = this.#units.channels(composed.color);
    const color =
      own === null
        ? this.css(composed.color, variable, context)
        : this.#solid.color(own, undefined, MODEL_NUMBER.fraction, context.tables);

    return MODEL_TEXT.mix(color, this.#opacity(composed.opacity, variable, context));
  }

  /** A composed colour's opacity: Figma keeps it in percents (up to 1 it is a fraction); a variable's by its unit. */
  #opacity(
    opacity: unknown,
    variable: RawVariable,
    context: VariableContext,
  ): string {
    if (typeof opacity === "number") {
      return MODEL_TEXT.percent(this.#decimal(this.#units.fraction(opacity) * MODEL_NUMBER.percent));
    }

    const target = this.#units.alias(opacity);
    const fraction = target !== null && context.units.get(target) === NUMBER_UNIT.opacity;

    return MODEL_TEXT.scaled(
      this.css(opacity, variable, context),
      fraction ? MODEL_VALUE.wholePercent : MODEL_VALUE.onePercent,
    );
  }

  #number(value: number, unit: NumberUnit): string {
    if (unit === NUMBER_UNIT.px) {
      return MODEL_TEXT.px(this.#decimal(value));
    }

    // An opacity is a percentage in Figma's opacity fields; CSS wants a fraction.
    return MODEL_TEXT.number(this.#decimal(unit === NUMBER_UNIT.opacity ? this.#units.fraction(value) : value));
  }

  #decimal(value: number): number {
    return this.#format.round(value, PRECISION.decimal);
  }

  #isEasing(value: unknown): value is FigmaEasing {
    return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
  }
}

export const VARIABLE_CSS = new InjectionToken<VariableCss>("VariableCss");
