import {
  BIND_DECISION,
  BIND_PATTERN,
  BIND_SOURCE,
  BIND_TEXT,
  KIND_WORDS,
  STYLE_TYPE,
} from "@/core/tokens/bind/bind.constants.ts";
import type { BindCandidate, BindChoice, BindDecision, BindKind, BindUse } from "@/core/tokens/bind/bind.types.ts";
import type { BindIndex } from "@/core/tokens/bind/bind-index.ts";
import { VARIABLE_TYPE } from "@/core/tokens/model/model.constants.ts";
import { BIND_KIND } from "@/shared/ops/bind/bind.constants.ts";

/** The call's picks (K-029): which token a value takes where several hold it, or a value to snap to a token. */
export class BindChoices {
  readonly #choices: readonly BindChoice[];
  readonly #index: BindIndex;

  constructor(choices: readonly BindChoice[], index: BindIndex) {
    this.#choices = choices;
    this.#index = index;
  }

  /** The call's pick for the value, else its one candidate; several left as they are, none unmatched. */
  decide(use: BindUse): BindDecision {
    const choice = this.#choices.find(
      ({ value, field }) =>
        this.#loose(value) === this.#loose(use.value) && (field === undefined || field === use.field),
    );

    if (choice !== undefined) {
      return this.#chosen(choice.token, use);
    }

    const [only, ...rest] = use.candidates;

    if (only === undefined) {
      return { kind: BIND_DECISION.unmatched };
    }

    return rest.length === 0
      ? { kind: BIND_DECISION.bound, candidate: only, snapped: false }
      : { kind: BIND_DECISION.ambiguous };
  }

  /** The picked token of the value's kind, a candidate first; snapped when it does not hold the value. */
  #chosen(token: string, use: BindUse): BindDecision {
    const fitting = this.#index.byToken(token).filter((candidate) => this.#fits(use.kind, candidate));
    const candidate = fitting.find(({ id }) => use.candidates.some((each) => each.id === id)) ?? fitting[0];

    if (candidate === undefined || (fitting.length > 1 && !use.candidates.includes(candidate))) {
      return {
        kind: BIND_DECISION.refused,
        message:
          fitting.length > 1
            ? BIND_TEXT.several(token, fitting.length)
            : BIND_TEXT.noKind(token, KIND_WORDS[use.kind] ?? use.kind),
      };
    }

    if (candidate.source === BIND_SOURCE.style && use.kind === BIND_KIND.color && !use.stylable) {
      return { kind: BIND_DECISION.refused, message: BIND_TEXT.paintStyle(token) };
    }

    return { kind: BIND_DECISION.bound, candidate, snapped: !use.candidates.some(({ id }) => id === candidate.id) };
  }

  /** Whether a token is of the kind a value takes: a colour a colour variable or a paint style, and so on. */
  #fits(kind: BindKind, { source, type }: BindCandidate): boolean {
    const variable = source === BIND_SOURCE.variable;
    const fits: Readonly<Record<BindKind, boolean>> = {
      [BIND_KIND.color]: variable ? type === VARIABLE_TYPE.color : type === STYLE_TYPE.paint,
      [BIND_KIND.number]: variable && type === VARIABLE_TYPE.float,
      [BIND_KIND.text]: !variable && type === STYLE_TYPE.text,
      [BIND_KIND.effect]: !variable && type === STYLE_TYPE.effect,
    };

    return fits[kind];
  }

  /** A value as the call may write it: spaces and case aside. */
  #loose(value: string): string {
    return value.replace(BIND_PATTERN.space, "").toLowerCase();
  }
}
