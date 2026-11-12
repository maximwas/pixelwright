import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DTCG_SCOPE, DTCG_TYPE } from "@/core/tokens/formats/dtcg/dtcg.constants.ts";
import type { DtcgType } from "@/core/tokens/formats/dtcg/dtcg.types.ts";
import { VARIABLE_TYPE } from "@/core/tokens/model/model.constants.ts";
import { NUMBER_UNITS } from "@/core/tokens/model/number-units.ts";
import type { RawVariable } from "@/shared/ops/variables/variables.schema.ts";

/**
 * Each variable's DTCG type (K-015): a colour `color`; a number `dimension` when scoped only to lengths, `fontWeight`
 * only to weights, else `number`; a text `fontFamily` only when scoped to families; none for the rest. Then the types
 * spread over alias links until nothing changes, so a reference never points at a token left out or of another unit
 * (a number aliased by a gap is a dimension, a text aliased by a font family a font family).
 */
@injectable()
export class DtcgTypes {
  readonly #units;

  constructor(units = inject(NUMBER_UNITS)) {
    this.#units = units;
  }

  types(variables: readonly RawVariable[]): Map<string, DtcgType | null> {
    const types = new Map(variables.map((variable) => [variable.id, this.#own(variable)]));
    const links = this.#units.links(variables);
    let changed = true;

    while (changed) {
      changed = false;

      for (const [from, to] of links) {
        // Either end of a link may be the one that knows better; both are tried until nothing changes.
        changed = this.#strengthened(types, from, to) || changed;
        changed = this.#strengthened(types, to, from) || changed;
      }
    }

    return types;
  }

  #own(variable: RawVariable): DtcgType | null {
    const only = (allowed: (scope: string) => boolean) =>
      variable.scopes.length > 0 && variable.scopes.every((scope) => allowed(scope));

    switch (variable.resolvedType) {
      case VARIABLE_TYPE.color:
        return DTCG_TYPE.color;
      case VARIABLE_TYPE.float:
        if (only((scope) => DTCG_SCOPE.lengths.includes(scope))) {
          return DTCG_TYPE.dimension;
        }

        return only((scope) => scope === DTCG_SCOPE.fontWeight) ? DTCG_TYPE.fontWeight : DTCG_TYPE.number;
      case VARIABLE_TYPE.string:
        return only((scope) => scope === DTCG_SCOPE.fontFamily) ? DTCG_TYPE.fontFamily : null;
      default:
        return null;
    }
  }

  /** Gives `weak` the type of `strong` when it has none, or only `number` where `strong` says more. */
  #strengthened(
    types: Map<string, DtcgType | null>,
    weak: string,
    strong: string,
  ): boolean {
    const own = types.get(weak) ?? null;
    const other = types.get(strong) ?? null;

    if (other === null || other === own || (own !== null && own !== DTCG_TYPE.number)) {
      return false;
    }

    types.set(weak, other);

    return true;
  }
}

export const DTCG_TYPES = new InjectionToken<DtcgTypes>("DtcgTypes");
