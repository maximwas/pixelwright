import { InjectionToken, injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import type { Channels } from "@/core/kernel/color/color.ts";
import {
  MODEL_NUMBER,
  NUMBER_UNIT,
  OPACITY_SCOPES,
  UNITLESS_SCOPES,
  VARIABLE_TYPE,
  VARIABLE_VALUE,
} from "@/core/tokens/model/model.constants.ts";
import {
  type ComposedColor,
  ComposedColorSchema,
  RawColorSchema,
  VariableAliasSchema,
} from "@/core/tokens/model/model.schema.ts";
import type { RawVariable } from "@/shared/ops/variables/variables.schema.ts";

export type NumberUnit = (typeof NUMBER_UNIT)[keyof typeof NUMBER_UNIT];

/**
 * A number variable's unit (K-003, B-057): the one its scopes give, else the one the numbers joined to it by aliases
 * agree on, either way (a hidden primitive that font weights point at is a plain number, not 700px), else px; a group
 * of two units stays px. Reads Figma's raw values the one way every format does: an alias and the links aliases make
 * (the groups' links, DTCG's types), a colour or a composed one, an opacity as a fraction.
 */
@injectable()
export class NumberUnits {
  units(variables: readonly RawVariable[]): Map<string, NumberUnit> {
    const numbers = variables.filter((variable) => variable.resolvedType === VARIABLE_TYPE.float);
    const groups = this.#groups(numbers);
    const known = new Map<string, Set<NumberUnit>>();

    for (const variable of numbers) {
      const unit = this.#scoped(variable.scopes);
      const group = groups.get(variable.id) ?? variable.id;

      if (unit !== null) {
        known.set(group, (known.get(group) ?? new Set()).add(unit));
      }
    }

    return new Map(
      numbers.map((variable) => {
        const linked = [...(known.get(groups.get(variable.id) ?? variable.id) ?? [])];
        const agreed = linked.length === 1 ? linked[0] : undefined;

        return [variable.id, this.#scoped(variable.scopes) ?? agreed ?? NUMBER_UNIT.px];
      }),
    );
  }

  /** The id of the variable a value points at, when the value is an alias `{ type: "VARIABLE_ALIAS", id }`. */
  alias(value: unknown): string | null {
    const alias = zod.safeParse(VariableAliasSchema, value);

    return alias.success ? alias.data.id : null;
  }

  /** Every alias among the variables, as [the variable, the one a value of it points at]. */
  links(variables: readonly RawVariable[]): (readonly [string, string])[] {
    return variables.flatMap((variable) =>
      Object.values(variable.valuesByMode).flatMap((value) => {
        const target = this.alias(value);

        return target === null ? [] : [[variable.id, target] as const];
      }),
    );
  }

  /** A colour as Figma keeps it; null for any other value. */
  channels(value: unknown): Channels | null {
    const color = zod.safeParse(RawColorSchema, value);

    return color.success ? color.data : null;
  }

  /** A composed colour: a colour and an opacity, either of them an alias; null for any other value. */
  composed(value: unknown): ComposedColor | null {
    const composed = zod.safeParse(ComposedColorSchema, value);

    return composed.success ? composed.data : null;
  }

  /** An opacity as a fraction: Figma keeps one in percent (fields, composed colours), and up to 1 it is one already. */
  fraction(opacity: number): number {
    return opacity > MODEL_NUMBER.fraction ? opacity / MODEL_NUMBER.percent : opacity;
  }

  /** The unit a number's scopes give it; null when they say nothing of it (no field, or every field). */
  #scoped(scopes: readonly string[]): NumberUnit | null {
    if (scopes.length === 0 || scopes.includes(VARIABLE_VALUE.allScopes)) {
      return null;
    }

    if (!scopes.every((scope) => UNITLESS_SCOPES.includes(scope))) {
      return NUMBER_UNIT.px;
    }

    return scopes.some((scope) => OPACITY_SCOPES.includes(scope)) ? NUMBER_UNIT.opacity : NUMBER_UNIT.number;
  }

  /** Union-find over the aliases between the numbers, either way: each number's group, named by one of its members. */
  #groups(numbers: readonly RawVariable[]): Map<string, string> {
    const parent = new Map(numbers.map((variable) => [variable.id, variable.id]));

    for (const [from, to] of this.links(numbers)) {
      if (parent.has(to)) {
        parent.set(this.#root(parent, from), this.#root(parent, to));
      }
    }

    return new Map(numbers.map((variable) => [variable.id, this.#root(parent, variable.id)]));
  }

  #root(parent: ReadonlyMap<string, string>, id: string): string {
    let at = id;

    for (let next = parent.get(at); next !== undefined && next !== at; next = parent.get(at)) {
      at = next;
    }

    return at;
  }
}

export const NUMBER_UNITS = new InjectionToken<NumberUnits>("NumberUnits");
