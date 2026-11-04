import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_PAINT } from "@/core/css/paints/paints.constants.ts";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import { DTCG_KEY, DTCG_NOTE, DTCG_TEXT } from "@/core/tokens/formats/dtcg/dtcg.constants.ts";
import type { DtcgGroup, DtcgResult, DtcgWriting } from "@/core/tokens/formats/dtcg/dtcg.types.ts";
import { DTCG_PATHS } from "@/core/tokens/formats/dtcg/dtcg-paths.ts";
import { DTCG_REFERENCES } from "@/core/tokens/formats/dtcg/dtcg-references.ts";
import { DTCG_STYLES } from "@/core/tokens/formats/dtcg/dtcg-styles.ts";
import { DTCG_VALUES } from "@/core/tokens/formats/dtcg/dtcg-values.ts";
import { STYLE_GROUPS, type StyleGroup } from "@/core/tokens/model/model.constants.ts";
import type { Tokens } from "@/core/tokens/model/model.schema.ts";
import type { RawCollection, RawStyle, RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";

/** A collection the model holds, with as many of its variables as the model holds. */
interface HeldCollection {
  readonly collection: RawCollection;
  readonly variables: readonly RawVariable[];
}

/**
 * The tokens as DTCG 2025.10 (K-013, X-013, D-27): a tree per mode of each collection the model holds, keyed
 * `<collection>.<mode>` (the collection alone when it has one mode), and a `styles` tree, the values taken from the raw
 * tokens the model was made of, so an agent saves each tree as its own token file. `tokens` may be the first part of
 * `whole` that fits maxChars (T-161): then only its variables, and the styles up to its last, are written. What DTCG
 * cannot hold is named in the notes, never dropped silently.
 */
@injectable()
export class TokensDtcg {
  readonly #references;
  readonly #paths;
  readonly #values;
  readonly #styles;

  constructor(
    references = inject(DTCG_REFERENCES),
    paths = inject(DTCG_PATHS),
    values = inject(DTCG_VALUES),
    styles = inject(DTCG_STYLES),
  ) {
    this.#references = references;
    this.#paths = paths;
    this.#values = values;
    this.#styles = styles;
  }

  write(
    raw: RawTokens,
    tokens: Tokens,
    whole: Tokens = tokens,
  ): DtcgResult {
    const held = this.#held(raw, tokens);
    const writing = this.#writing(raw, new Set(held.map(({ collection }) => collection.id)));
    // The styles' key is taken first, so a collection named Styles gets another.
    const keys = new Set<string>([DTCG_KEY.styles]);
    const trees: Record<string, DtcgGroup> = {};

    for (const { collection, variables } of held) {
      Object.assign(trees, this.#trees(collection, variables, keys, writing));
    }

    const styles = this.#styles.tree(this.#heldStyles(raw.styles, tokens, whole), writing.space);

    trees[DTCG_KEY.styles] = styles.tree;

    return { trees, notes: [...this.#notes(writing), ...styles.notes] };
  }

  /** The collections the model holds, in its order, each with its first variables: a cut keeps the first. */
  #held(raw: RawTokens, tokens: Tokens): HeldCollection[] {
    let next = 0;

    return raw.collections.flatMap((collection) => {
      const held = tokens.collections[next];

      if (held?.name !== collection.name) {
        return [];
      }

      next += 1;

      return [
        {
          collection,
          variables: raw.variables
            .filter((variable) => variable.collectionId === collection.id)
            .slice(0, held.variables.length),
        },
      ];
    });
  }

  /**
   * The styles a part of the model holds: every one of a kind it holds whole, else those up to its last of that kind;
   * a style CSS could not write (and the model left out) goes along with the ones around it.
   */
  #heldStyles(
    styles: readonly RawStyle[],
    tokens: Tokens,
    whole: Tokens,
  ): RawStyle[] {
    const counted: Record<StyleGroup, number> = { paint: 0, text: 0, effect: 0 };

    return styles.filter((style) => {
      const group = STYLE_GROUPS[style.type];

      if (group === undefined || tokens.styles[group].length === whole.styles[group].length) {
        return true;
      }

      const held = tokens.styles[group];

      if (counted[group] >= held.length) {
        return false;
      }

      if (held[counted[group]]?.name === style.name) {
        counted[group] += 1;
      }

      return true;
    });
  }

  /** A collection's trees by key: one per mode, or the collection's alone when it has one mode. */
  #trees(
    collection: RawCollection,
    variables: readonly RawVariable[],
    keys: Set<string>,
    writing: DtcgWriting,
  ): Record<string, DtcgGroup> {
    const wanted = this.#paths.key(collection.name);
    const key = this.#paths.unique(wanted, keys);
    const modes = new Set<string>();

    if (key !== wanted) {
      writing.renamed.push(DTCG_NOTE.renamedCollection(collection.name, key, wanted));
    }

    return Object.fromEntries(
      collection.modes.map((mode) => {
        const tree: DtcgGroup = {};

        for (const variable of variables) {
          const token = this.#values.token(variable, mode, writing);

          if (token !== null) {
            this.#paths.put(tree, writing.places.locations.get(variable.id) ?? [], token);
          }
        }

        const modeKey = this.#paths.unique(this.#paths.key(mode.name), modes);

        return [collection.modes.length === 1 ? key : DTCG_TEXT.key(key, modeKey), tree];
      }),
    );
  }

  #writing(raw: RawTokens, written: ReadonlySet<string>): DtcgWriting {
    return {
      raw,
      written,
      places: this.#references.places(raw, written),
      space: raw.colorProfile === FIGMA_PAINT.displayP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb,
      variables: new Map(raw.variables.map((variable) => [variable.id, variable])),
      renamed: [],
      untyped: new Map(),
      lost: new Set(),
      outside: new Map(),
      unwritten: new Set(),
    };
  }

  /** What could not be written as it is: renames, untyped variables, lost and outside aliases, values left out. */
  #notes(writing: DtcgWriting): string[] {
    const untyped = [...writing.untyped].map(([name, type]) => DTCG_TEXT.typed(name, type));

    return [
      ...writing.renamed,
      ...writing.places.renamed,
      ...(untyped.length === 0 ? [] : [DTCG_NOTE.untyped(untyped)]),
      ...[...writing.lost].map((name) => DTCG_NOTE.lost(name)),
      ...writing.outside.values(),
      ...writing.unwritten,
    ];
  }
}

export const TOKENS_DTCG = new InjectionToken<TokensDtcg>("TokensDtcg");
