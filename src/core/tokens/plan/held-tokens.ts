import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { MODEL_TEXT, STYLE_GROUPS } from "@/core/tokens/model/model.constants.ts";
import type { StyleTokenGroups } from "@/core/tokens/model/model.schema.ts";
import { NUMBER_UNITS } from "@/core/tokens/model/number-units.ts";
import { TOKEN_MODEL } from "@/core/tokens/model/token-model.ts";
import { STYLE_SUFFIXES } from "@/core/tokens/plan/plan.constants.ts";
import type { FileTokens, HeldCollection, HeldStyle, HeldTarget } from "@/core/tokens/plan/plan.types.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * The file's tokens as tokens_apply sets a call against them (T-165, K-023): through tokens_read's own model, so a
 * value is compared in the CSS tokens_read writes; each collection with its modes and variables, a library's marked;
 * each style with its token and CSS; the tokens aliases can reach; each number's unit; the libraries' collections.
 */
@injectable()
export class HeldTokens {
  readonly #model;
  readonly #units;
  readonly #names;

  constructor(
    model = inject(TOKEN_MODEL),
    units = inject(NUMBER_UNITS),
    names = inject(TOKEN_NAMES),
  ) {
    this.#model = model;
    this.#units = units;
    this.#names = names;
  }

  of(raw: RawTokens): FileTokens {
    const model = this.#model.model(raw);
    // The model writes every collection of the read in its order: the raw one at the same place is its own.
    const collections: HeldCollection[] = model.collections.map(({ name, modes, variables }, index) => ({
      id: raw.collections[index]?.id ?? "",
      name,
      remote: raw.collections[index]?.remote ?? false,
      modes,
      variables,
    }));

    return {
      collections,
      styles: this.#styles(raw, model.styles),
      tokens: this.#targets(raw, collections),
      units: this.#units.units(raw.variables),
      library: new Set((raw.library ?? []).map(({ collection }) => collection)),
    };
  }

  /**
   * Each variable an alias can reach by its token; the file's own wins over a library's the page uses, and that over an
   * enabled library's not used yet (the first library's of a token, as design_apply finds it), which has only its key.
   */
  #targets(raw: RawTokens, collections: readonly HeldCollection[]): Map<string, HeldTarget> {
    const catalogue = (raw.library ?? []).flatMap(({ variables }) =>
      variables.map(
        ({ name, key, resolvedType }) =>
          [this.#names.token(name), { id: key, type: resolvedType, aliases: {}, key }] as const,
      ),
    );
    const library = Object.entries(raw.external).map(
      ([id, variable]) => [this.#names.variable(variable), { id, type: variable.resolvedType, aliases: {} }] as const,
    );
    const own = collections.flatMap(({ variables }) =>
      variables.map(
        ({ token, id, type, aliasOf }) =>
          [
            token,
            {
              id,
              type,
              aliases: Object.fromEntries(
                Object.entries(aliasOf ?? {}).flatMap(([mode, [direct]]) =>
                  direct === undefined ? [] : [[mode, direct]],
                ),
              ),
            },
          ] as const,
      ),
    );

    return new Map([...catalogue.reverse(), ...library, ...own]);
  }

  /**
   * Each paint, text and effect style with its CSS and the token tokens_read lists it by, when CSS can draw it: its
   * own (--White-2), or with the part it writes first (--Heading-H1-font, a blur alone's --Frost-backdrop-filter).
   */
  #styles(raw: RawTokens, written: StyleTokenGroups): HeldStyle[] {
    return raw.styles.flatMap((style) => {
      const group = STYLE_GROUPS[style.type];

      if (group === undefined) {
        return [];
      }

      const own = this.#names.style(style);
      const tokens = [own, ...STYLE_SUFFIXES.map((suffix) => MODEL_TEXT.part(own, suffix))];
      const css = written[group].find((each) => each.name === style.name && tokens.includes(each.token));
      const token = css?.token ?? own;

      return [
        { id: style.id, name: style.name, group, remote: style.remote, token, ...(css === undefined ? {} : { css }) },
      ];
    });
  }
}

export const HELD_TOKENS = new InjectionToken<HeldTokens>("HeldTokens");
