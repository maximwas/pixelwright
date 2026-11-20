import { InjectionToken, inject, injectable } from "@needle-di/core";
import { COLLECTION_PLANS } from "@/core/tokens/plan/collection-plans.ts";
import { HELD_TOKENS } from "@/core/tokens/plan/held-tokens.ts";
import { PLAN_TEXT } from "@/core/tokens/plan/plan.constants.ts";
import type { TokensInput } from "@/core/tokens/plan/plan.schema.ts";
import type { CollectionDraft, FileTokens, PlannedTokens } from "@/core/tokens/plan/plan.types.ts";
import { type FindTarget, STYLE_PLANS } from "@/core/tokens/plan/style-plans.ts";
import { PLAN_VALUE, TOKEN_KIND, WRITABLE_TYPE } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type {
  TokensPlan as Plan,
  TokenError,
  TokenItem,
  VariableTarget,
} from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * tokens_apply's plan (T-165, K-018..K-025): tokens_read's JSON, or the same shape by hand, set against the file's own
 * tokens by name. What the file lacks is made, what it holds is changed only where its CSS reads otherwise, nothing is
 * deleted, and a library's collection or style is never copied (one equal to the call's passes, another is an error).
 * Modes come in the order they first appear; what Figma would refuse, or tokens_apply cannot write, is that token's
 * error while the rest is planned; an alias, and a style's colour, needs its variable in the file, an enabled library
 * (imported by the write, which the plan notes) or the call.
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
    const styles = this.#styles.plan(input.styles, file.styles, this.#targets(drafts, file));
    const collections = kept.map(({ name, id, modes, entries }) => ({
      name,
      ...(id === undefined ? {} : { id }),
      modes: [...modes],
      variables: entries.map(({ plan }) => plan),
    }));
    const targets = Object.keys(styles.targets).length === 0 ? {} : { targets: styles.targets };

    return {
      plan: { collections, styles: styles.styles, ...targets },
      created: [...kept.flatMap((draft) => this.#created(draft)), ...styles.created],
      updated: [
        ...kept.flatMap(({ name, entries }) =>
          entries.flatMap(({ plan }) => (plan.id === undefined ? [] : [this.#named(plan.name, name)])),
        ),
        ...styles.updated,
      ],
      errors: [...errors, ...styles.errors],
      notes: [...notes, ...this.#imports(collections, styles.targets)],
    };
  }

  /**
   * Where a style's colour token is: a variable of the call (by its id when the file holds it), else the file's, a
   * library's the page uses or an enabled library's by its key; why not, when it names none or no colour.
   */
  #targets(drafts: readonly CollectionDraft[], file: FileTokens): FindTarget {
    const calls = new Map(drafts.flatMap(({ entries }) => entries.map(({ token, plan }) => [token, plan] as const)));

    return (token: string): VariableTarget | string => {
      const call = calls.get(token);
      const shared = call === undefined ? file.shared.get(token) : undefined;

      return shared === undefined ? this.#target(token, call, file) : PLAN_TEXT.sharedTarget(token, shared);
    };
  }

  /** A style's colour token as the call's variable, else the file's one of that token. */
  #target(
    token: string,
    call: CollectionDraft["entries"][number]["plan"] | undefined,
    file: FileTokens,
  ): VariableTarget | string {
    const held = call === undefined ? file.tokens.get(token) : undefined;
    const type = call?.type ?? held?.type;

    if (type === undefined) {
      return PLAN_TEXT.noTarget(token);
    }

    if (type !== WRITABLE_TYPE.COLOR) {
      return PLAN_TEXT.notColour(token, type);
    }

    if (held === undefined) {
      return call?.id === undefined ? {} : { id: call.id };
    }

    return held.key === undefined ? { id: held.id } : { key: held.key };
  }

  /** The enabled libraries' variables the write imports, each said once (m:acc257ba). */
  #imports(collections: Plan["collections"], targets: Readonly<Record<string, VariableTarget>>): string[] {
    const values = collections.flatMap(({ variables }) =>
      variables.flatMap(({ values: modes }) => Object.values(modes)),
    );
    const tokens = [
      ...values.flatMap((value) => (value.kind === PLAN_VALUE.alias && value.key !== undefined ? [value.token] : [])),
      ...Object.entries(targets).flatMap(([token, { key }]) => (key === undefined ? [] : [token])),
    ];

    return [...new Set(tokens)].map((token) => PLAN_TEXT.imported(token));
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
