import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_VAR } from "@/core/css/values/css-var.ts";
import { BOOLEAN_CSS, GUESS_ORDER, PLAN_PATTERN, TYPE_OF_VALUE } from "@/core/tokens/plan/plan.constants.ts";
import { PLAN_VALUE, WRITABLE_TYPE } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { PlanValue, WritableType } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/**
 * A mode's CSS read back as tokens_read writes it (K-019): any CSS colour, faded by color-mix() as tokens_read writes a
 * colour with opacity; a length in px or a plain number; a quoted string, its escapes undone; true or false;
 * var(--token) as an alias. A value with no type yet is tried as a boolean, a number, a string, then a colour.
 */
@injectable()
export class VariableValues {
  readonly #vars;
  readonly #lengths;

  constructor(vars = inject(CSS_VAR), lengths = inject(CSS_LENGTH)) {
    this.#vars = vars;
    this.#lengths = lengths;
  }

  /** Whether tokens_apply writes variables of this type. */
  writable(type: string): type is WritableType {
    return Object.hasOwn(WRITABLE_TYPE, type);
  }

  /** The value as the type takes it, an alias whatever the type; null when it is not one. */
  value(css: string, type: WritableType | null): PlanValue | null {
    const value = css.trim();
    const token = this.#vars.token(value);

    if (token !== null) {
      return { kind: PLAN_VALUE.alias, token: token.token };
    }

    for (const guess of type === null ? GUESS_ORDER : [type]) {
      const read = this.#read(guess, value);

      if (read !== null) {
        return read;
      }
    }

    return null;
  }

  /** The type a value gives a variable given none; an alias gives none. */
  typeOf(value: PlanValue): WritableType | null {
    return TYPE_OF_VALUE[value.kind];
  }

  #read(type: WritableType, value: string): PlanValue | null {
    switch (type) {
      case WRITABLE_TYPE.COLOR:
        return this.#color(value);
      case WRITABLE_TYPE.FLOAT:
        return this.#number(value);
      case WRITABLE_TYPE.STRING:
        return this.#string(value);
      default:
        return this.#boolean(value);
    }
  }

  #color(value: string): PlanValue | null {
    const faded = this.#vars.fade(value);

    return faded?.color === null || faded === null
      ? null
      : { kind: PLAN_VALUE.color, color: faded.color.faded(faded.share).value() };
  }

  #number(value: string): PlanValue | null {
    const length = this.#lengths.pixels(value);

    return typeof length === "number" ? { kind: PLAN_VALUE.number, value: length } : null;
  }

  #string(value: string): PlanValue | null {
    const quoted = PLAN_PATTERN.quoted.exec(value)?.[2];

    return quoted === undefined
      ? null
      : { kind: PLAN_VALUE.string, value: quoted.replaceAll(PLAN_PATTERN.escaped, (_escape, kept: string) => kept) };
  }

  #boolean(value: string): PlanValue | null {
    return value === BOOLEAN_CSS.true || value === BOOLEAN_CSS.false
      ? { kind: PLAN_VALUE.boolean, value: value === BOOLEAN_CSS.true }
      : null;
  }
}

export const VARIABLE_VALUES = new InjectionToken<VariableValues>("VariableValues");
