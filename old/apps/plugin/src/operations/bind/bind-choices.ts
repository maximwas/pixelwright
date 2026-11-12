import type { BindCandidate, BindIndex, BindInput, BindKind } from "@pixelwright/core";
import type { RawUse } from "./raw-use.ts";

/** What becomes of a raw value: bound to a token (snapped when it was not the token's), left, or refused. */
export type BindDecision =
  | { readonly kind: "bound"; readonly candidate: BindCandidate; readonly snapped: boolean }
  | { readonly kind: "ambiguous" }
  | { readonly kind: "unmatched" }
  | { readonly kind: "refused"; readonly message: string };

/** The tokens each kind of value takes, and how a refusal names them. */
const KINDS: Readonly<Record<BindKind, { fits: (candidate: BindCandidate) => boolean; words: string }>> = {
  color: {
    fits: ({ source, type }) => (source === "variable" && type === "COLOR") || (source === "style" && type === "PAINT"),
    words: "colour token: give a colour variable or a paint style",
  },
  number: {
    fits: ({ source, type }) => source === "variable" && type === "FLOAT",
    words: "number token: give a number variable",
  },
  text: {
    fits: ({ source, type }) => source === "style" && type === "TEXT",
    words: "text style",
  },
  effect: {
    fits: ({ source, type }) => source === "style" && type === "EFFECT",
    words: "effect style",
  },
};

/** A value as the call may write it: spaces and case aside. */
const loose = (value: string) => value.replace(/\s+/g, "").toLowerCase();

/** The call's picks: which token a value takes where several hold it, or a value to snap to a token. */
export class BindChoices {
  readonly #choices: BindInput["choose"];
  readonly #index: BindIndex;

  constructor(choices: BindInput["choose"], index: BindIndex) {
    this.#choices = choices;
    this.#index = index;
  }

  /** The call's pick for the value, else its one candidate; several left as they are, none unmatched. */
  decide(use: RawUse): BindDecision {
    const choice = this.#choices.find(
      ({ value, field }) => loose(value) === loose(use.value) && (field === undefined || field === use.field),
    );

    if (choice !== undefined) {
      return this.#chosen(choice.token, use);
    }

    const [only, ...rest] = use.candidates;

    if (only === undefined) {
      return { kind: "unmatched" };
    }

    return rest.length === 0
      ? {
          kind: "bound",
          candidate: only,
          snapped: false,
        }
      : { kind: "ambiguous" };
  }

  #chosen(token: string, use: RawUse): BindDecision {
    const { fits, words } = KINDS[use.kind];
    const fitting = this.#index.byToken(token).filter(fits);
    const candidate = fitting.find(({ id }) => use.candidates.some((each) => each.id === id)) ?? fitting[0];

    if (candidate === undefined || (fitting.length > 1 && !use.candidates.includes(candidate))) {
      return {
        kind: "refused",
        message:
          fitting.length > 1 ? `${token} names ${fitting.length} tokens of its kind.` : `${token} is no ${words}.`,
      };
    }

    if (candidate.source === "style" && use.kind === "color" && use.stylable === false) {
      return {
        kind: "refused",
        message: `${token} is a paint style, the whole list of a layer's paints: this layer has several.`,
      };
    }

    return {
      kind: "bound",
      candidate,
      snapped: !use.candidates.some(({ id }) => id === candidate.id),
    };
  }
}
