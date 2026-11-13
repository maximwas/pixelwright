import { InjectionToken, inject, injectable } from "@needle-di/core";
import { COLLECTION_PLANS } from "@/core/tokens/plan/collection-plans.ts";
import { HELD_TOKENS } from "@/core/tokens/plan/held-tokens.ts";
import type { TokensInput } from "@/core/tokens/plan/plan.schema.ts";
import type { CollectionDraft, PlannedTokens } from "@/core/tokens/plan/plan.types.ts";
import { STYLE_PLANS } from "@/core/tokens/plan/style-plans.ts";
import { TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { TokenError, TokenItem } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * tokens_apply's plan (T-165, K-018..K-025): tokens_read's JSON, or the same shape by hand, set against the file's own
 * tokens by name. What the file lacks is made, what it holds is changed only where its CSS reads otherwise, nothing is
 * deleted, and a library's collection or style is never copied (one equal to the call's passes, another is an error).
 * Modes come in the order they first appear; what Figma would refuse, or tokens_apply cannot write, is that token's
 * error while the rest is planned; an alias needs its target in the file or in the call.
 */
@injectable()
export class TokensPlan {
  readonly #held;
  readonly #collections;
  readonly #styles;

  constructor(
    held = inject(HELD_TOKENS),
    collections = inject(COLLECTION_PLANS),
    styles = inject(STYLE_PLANS),
  ) {
    this.#held = held;
    this.#collections = collections;
    this.#styles = styles;
  }

  plan(input: TokensInput, raw: RawTokens): PlannedTokens {
    const file = this.#held.of(raw);
    const errors: TokenError[] = [];
    const { drafts, notes } = this.#collections.plan(input.collections, file, errors);
    const kept = drafts.filter(({ id, modes, entries }) => id === undefined || modes.length > 0 || entries.length > 0);
    const styles = this.#styles.plan(input.styles, file.styles);

    return {
      plan: {
        collections: kept.map(({ name, id, modes, entries }) => ({
          name,
          ...(id === undefined ? {} : { id }),
          modes: [...modes],
          variables: entries.map(({ plan }) => plan),
        })),
        styles: styles.styles,
      },
      created: [...kept.flatMap((draft) => this.#created(draft)), ...styles.created],
      updated: [
        ...kept.flatMap(({ name, entries }) =>
          entries.flatMap(({ plan }) => (plan.id === undefined ? [] : [this.#named(plan.name, name)])),
        ),
        ...styles.updated,
      ],
      errors: [...errors, ...styles.errors],
      notes,
    };
  }

  /** What a collection's plan makes: the collection when it is new, its modes, its new variables. */
  #created({ name, id, modes, entries }: CollectionDraft): TokenItem[] {
    return [
      ...(id === undefined ? [{ kind: TOKEN_KIND.collection, name }] : []),
      ...modes.map((mode) => ({ kind: TOKEN_KIND.mode, name: mode, collection: name })),
      ...entries.flatMap(({ plan }) => (plan.id === undefined ? [this.#named(plan.name, name)] : [])),
    ];
  }

  #named(name: string, collection: string): { kind: typeof TOKEN_KIND.variable; name: string; collection: string } {
    return { kind: TOKEN_KIND.variable, name, collection };
  }
}

export const TOKENS_PLAN = new InjectionToken<TokensPlan>("TokensPlan");
