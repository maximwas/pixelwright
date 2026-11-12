import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LAYER_TREE } from "@/core/design/tree/layer-tree.ts";
import { BASELINE_CHANGE, BASELINE_CHANGE_TEXT } from "@/core/diff/baseline/baseline.constants.ts";
import type { BaselineChanges, BaselineCounts } from "@/core/diff/baseline/baseline.schema.ts";
import type { BaselineComparison, BaselineSide, Placed, Side } from "@/core/diff/baseline/baseline.types.ts";
import { ComponentChanges } from "@/core/diff/baseline/component-changes.ts";
import { LAYER_CHANGES } from "@/core/diff/baseline/layer-changes.ts";
import { LayerPairs } from "@/core/diff/baseline/layer-pairs.ts";
import { STRUCTURE_CHANGES } from "@/core/diff/baseline/structure-changes.ts";
import { TOKEN_CHANGES, type TokenChanges } from "@/core/diff/baseline/token-changes.ts";
import { DIFF, DIFF_TEXT } from "@/core/diff/diff.constants.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * What changed between a baseline and the design now, in design_read's terms (T-205, K-055..K-057): both reads built
 * as today's design_read builds them (the baseline with the live names of the tokens both use, so a renamed token is
 * one token change, not a var() change on every layer), layers paired by id, then by tag and name, then by name
 * (LayerPairs); each pair's changes (LayerChanges) and the structure's (StructureChanges); a change two or more
 * instances share once (ComponentChanges); the tokens in every mode (TokenChanges); each list cut to DIFF.maxEntries,
 * `more` counting the rest. `same` ignores what was not compared.
 */
@injectable()
export class BaselineDiff {
  readonly #readLayers = new ReadLayers();
  readonly #tree;
  readonly #changes;
  readonly #structure;
  readonly #tokens;

  constructor(
    tree = inject(LAYER_TREE),
    changes = inject(LAYER_CHANGES),
    structure = inject(STRUCTURE_CHANGES),
    tokens: Pick<TokenChanges, "of"> = inject(TOKEN_CHANGES),
  ) {
    this.#tree = tree;
    this.#changes = changes;
    this.#structure = structure;
    this.#tokens = tokens;
  }

  compare(
    before: BaselineSide,
    after: BaselineSide,
    sameReader: boolean,
  ): BaselineComparison {
    const live = this.#liveNames(before.snapshot, after.snapshot);
    const sides = { before: this.#layers(live), after: this.#layers(after.snapshot) };
    const pairs = new LayerPairs(this.#side(live, sides.before), this.#side(after.snapshot, sides.after));
    const pages = [before.snapshot.page, after.snapshot.page] as const;
    const layers = this.#changes.of(pairs, { ...sides, sameReader, pages });
    const { added, removed, moved, reordered } = this.#structure.of(pairs, sides);
    const notes = this.#profile(before.snapshot, after.snapshot);
    const skip = pairs.excluded();
    const tokens = this.#tokens.of(
      {
        before: { raw: before.tokens, snapshot: before.snapshot, layers: pairs.before, skip: skip.before },
        after: { raw: after.tokens, snapshot: after.snapshot, layers: pairs.after, skip: skip.after },
      },
      notes,
    );
    const folded = new ComponentChanges(pairs, sides).fold({ changed: layers.changed, added, removed });

    return this.#capped(
      { ...folded, moved, reordered, tokens, notCompared: [...this.#structure.cut(pairs), ...layers.notCompared] },
      notes,
    );
  }

  /** The baseline's read with the live read's names (and code syntax, and number) of the tokens both use, by id. */
  #liveNames(before: ReadModel, after: ReadModel): ReadModel {
    const variables = Object.entries(before.variables).map(([id, variable]) => {
      const live = after.variables[id];

      if (live === undefined) {
        return [id, variable] as const;
      }

      const renamed = { ...variable, name: live.name };

      // The live side's code syntax names the token now: none there is none.
      delete renamed.codeSyntax;

      return [id, live.codeSyntax === undefined ? renamed : { ...renamed, codeSyntax: live.codeSyntax }] as const;
    });
    const styles = Object.entries(before.styles).map(([id, style]) => {
      const live = after.styles[id];

      if (live === undefined) {
        return [id, style] as const;
      }

      const renamed = { ...style, name: live.name };

      // The live side's number among namesakes (--Black-2): none there is none.
      delete renamed.duplicate;

      return [id, live.duplicate === undefined ? renamed : { ...renamed, duplicate: live.duplicate }] as const;
    });

    return { ...before, variables: Object.fromEntries(variables), styles: Object.fromEntries(styles) };
  }

  #layers(model: ReadModel): Map<string, ReadLayer> {
    return new Map([...this.#readLayers.walk(model.root)].map(({ layer }) => [layer.id, layer]));
  }

  /** Every element of a read's tree by id, in document order, with its parent, label and path. */
  #side(model: ReadModel, layers: ReadonlyMap<string, ReadLayer>): Side {
    const root = this.#tree.root(model);

    if (root === null) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DIFF_TEXT.noElement(model.root.id));
    }

    const side = new Map<string, Placed>();

    this.#place(root, null, side, layers);

    return side;
  }

  #place(
    element: XmlElement,
    parent: Placed | null,
    side: Map<string, Placed>,
    layers: ReadonlyMap<string, ReadLayer>,
  ): void {
    const layer = layers.get(element.id);

    // design_read writes a hidden layer as a stub: here it is gone, so it is removed (now hidden) or added (was hidden).
    if (layer?.visible === false) {
      return;
    }

    const name = layer?.name ?? "";
    const label = DIFF_TEXT.label(element.tag, name.slice(0, BASELINE_CHANGE.labelChars), 0);
    const placed = { element, parent: parent?.element.id ?? null, name, label, path: this.#path(parent, label) };

    side.set(element.id, placed);

    for (const child of element.children) {
      this.#place(child, placed, side, layers);
    }
  }

  /** The labels below the root joined; the root is "(root)". */
  #path(parent: Placed | null, label: string): string {
    if (parent === null) {
      return DIFF.root;
    }

    return parent.parent === null ? label : [parent.path, label].join(DIFF.joiner);
  }

  /** A note when the file's colour profile is not the one the baseline was read in. */
  #profile(before: ReadModel, after: ReadModel): string[] {
    const was = before.colorProfile ?? BASELINE_CHANGE.legacyProfile;
    const now = after.colorProfile ?? BASELINE_CHANGE.legacyProfile;

    return was === now ? [] : [BASELINE_CHANGE_TEXT.profile(was, now)];
  }

  /** Each list cut to the cap, with how many entries each held and how many were left out. */
  #capped(changes: BaselineChanges, notes: string[]): BaselineComparison {
    const cap = DIFF.maxEntries;
    const counts: BaselineCounts = {
      changed: changes.changed.length,
      added: changes.added.length,
      removed: changes.removed.length,
      moved: changes.moved.length,
      reordered: changes.reordered.length,
      components: changes.components.length,
      tokens: changes.tokens.length,
    };
    const lengths = [...Object.values(counts), changes.notCompared.length];

    return {
      same: Object.values(counts).every((count) => count === 0),
      changes: {
        changed: changes.changed.slice(0, cap),
        added: changes.added.slice(0, cap),
        removed: changes.removed.slice(0, cap),
        moved: changes.moved.slice(0, cap),
        reordered: changes.reordered.slice(0, cap),
        components: changes.components.slice(0, cap),
        tokens: changes.tokens.slice(0, cap),
        notCompared: changes.notCompared.slice(0, cap),
      },
      counts,
      more: lengths.reduce((sum, length) => sum + Math.max(0, length - cap), 0),
      notes,
    };
  }
}

export const BASELINE_DIFF = new InjectionToken<BaselineDiff>("BaselineDiff");
