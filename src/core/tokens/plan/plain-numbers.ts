import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PATTERN } from "@/core/css/values/values.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { MODEL_NUMBER, NUMBER_UNIT } from "@/core/tokens/model/model.constants.ts";
import { NUMBER_UNITS, type NumberUnit } from "@/core/tokens/model/number-units.ts";
import { PLAN_TEXT } from "@/core/tokens/plan/plan.constants.ts";
import type { CollectionDraft, NumberedDrafts, VariableEntry } from "@/core/tokens/plan/plan.types.ts";
import { PLAN_VALUE, WRITABLE_TYPE } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";

/**
 * The planned numbers in Figma's terms (K-022, K-024, FX-049). A number's unit is its scopes', else the file's for one
 * it holds (K-003), else that of a variable of the call scoped as a plain number or an opacity that points at it, else
 * px: tokens_read reads it back by the same rule. An opacity is written in percent, as Figma keeps one (0.5 is 50;
 * above 1 it is one already), and plain numbers that will read back in px are noted.
 */
@injectable()
export class PlainNumbers {
  readonly #units;
  readonly #format;

  constructor(units = inject(NUMBER_UNITS), format = inject(NUMBER_FORMAT)) {
    this.#units = units;
    this.#format = format;
  }

  numbers(drafts: readonly CollectionDraft[], held: ReadonlyMap<string, NumberUnit>): NumberedDrafts {
    const aliased = this.#aliased(drafts.flatMap(({ entries }) => entries));
    const notes: string[] = [];
    const numbered = drafts.map((draft) => ({
      ...draft,
      entries: draft.entries.map((entry) => {
        if (entry.plan.type !== WRITABLE_TYPE.FLOAT) {
          return entry;
        }

        const unit = this.#unit(entry, held, aliased);

        if (unit === NUMBER_UNIT.px && this.#plain(entry.css)) {
          notes.push(PLAN_TEXT.unitless(entry.plan.name, draft.name));
        }

        return unit === NUMBER_UNIT.opacity ? this.#percent(entry) : entry;
      }),
    }));

    return { drafts: numbered, notes };
  }

  #unit(
    entry: VariableEntry,
    held: ReadonlyMap<string, NumberUnit>,
    aliased: ReadonlyMap<string, NumberUnit>,
  ): NumberUnit {
    const { scopes, id } = entry.plan;
    const own =
      scopes === undefined ? (id === undefined ? undefined : held.get(id)) : (this.#units.scoped(scopes) ?? undefined);

    return own ?? aliased.get(entry.token) ?? NUMBER_UNIT.px;
  }

  /** The unit each token takes from a variable of the call that points at it, scoped as a plain number or an opacity. */
  #aliased(entries: readonly VariableEntry[]): Map<string, NumberUnit> {
    return new Map(
      entries.flatMap(({ plan }) => {
        const unit = plan.scopes === undefined ? null : this.#units.scoped(plan.scopes);

        return unit === null || unit === NUMBER_UNIT.px
          ? []
          : Object.values(plan.values).flatMap((value) =>
            value.kind === PLAN_VALUE.alias ? [[value.token, unit] as const] : [],
          );
      }),
    );
  }

  /** Whether every value is a number with no unit, not all of them 0. */
  #plain(css: readonly string[]): boolean {
    return (
      css.length > 0 && css.every((value) => CSS_PATTERN.bare.test(value)) && css.some((value) => Number(value) !== 0)
    );
  }

  #percent(entry: VariableEntry): VariableEntry {
    const values = Object.fromEntries(
      Object.entries(entry.plan.values).map(([mode, value]) => [
        mode,
        value.kind === PLAN_VALUE.number && value.value <= MODEL_NUMBER.fraction
          ? { ...value, value: this.#format.round(value.value * MODEL_NUMBER.percent, PRECISION.decimal) }
          : value,
      ]),
    );

    return { ...entry, plan: { ...entry.plan, values } };
  }
}

export const PLAIN_NUMBERS = new InjectionToken<PlainNumbers>("PlainNumbers");
