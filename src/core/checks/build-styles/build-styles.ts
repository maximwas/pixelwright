import { InjectionToken, inject, injectable } from "@needle-di/core";
import { BUILD_STYLES_TEXT } from "@/core/checks/build-styles/build-styles.constants.ts";
import type { LayerComparison, StylesCompared } from "@/core/checks/build-styles/build-styles.schema.ts";
import type { StylePair } from "@/core/checks/build-styles/build-styles.types.ts";
import { STYLE_CHECK } from "@/core/checks/build-styles/style-check.ts";
import { CSS_ORDER } from "@/core/css/css.constants.ts";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import { DESIGN_BUILDER } from "@/core/design/builder/design-builder.ts";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";
import { READ_CATALOGUE } from "@/core/design/text/read-catalogue.ts";
import { ReadLayers, type WalkedLayer } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A read with what its layers' CSS needs: its asset plan, its tokens and its text styles, as design_read has them. */
interface PlannedRead {
  readonly model: ReadModel;
  readonly plan: AssetPlan;
  readonly tokens: Readonly<Record<string, string>>;
  readonly textStyles: Readonly<Record<string, string>>;
}

/** A layer of the reads, the layer it sits in, its read, and whether an icon or an image above it draws it. */
interface FoundLayer extends WalkedLayer {
  readonly read: PlannedRead;
  readonly drawn: boolean;
}

/**
 * styles_compare's engine (T-090): each pair's layer is found in the reads and written as design_read writes it (its
 * element's CSS through DesignBuilder and the read's asset plan, the read's tokens and text styles); StyleCheck holds
 * the build's computed styles against it. A layer another pair's read holds sits in its parent there; any other is
 * its own read's root (its size, not its place: the read op gives no parent). A hidden layer (a stub in the read) and
 * one an icon or an image draws are noted, not compared. Layers with differences come first.
 */
@injectable()
export class BuildStyles {
  readonly #readLayers = new ReadLayers();
  readonly #css: ReadonlySet<string> = new Set(CSS_ORDER);
  readonly #builder;
  readonly #planner;
  readonly #catalogue;
  readonly #check;

  constructor(
    builder = inject(DESIGN_BUILDER),
    planner = inject(ASSET_PLANNER),
    catalogue = inject(READ_CATALOGUE),
    check = inject(STYLE_CHECK),
  ) {
    this.#builder = builder;
    this.#planner = planner;
    this.#catalogue = catalogue;
    this.#check = check;
  }

  compare(
    reads: readonly ReadModel[],
    pairs: readonly StylePair[],
    tolerance: number,
  ): StylesCompared {
    const found = this.#found(reads);
    const notes = new Set<string>();
    const layers: LayerComparison[] = [];
    const missing: string[] = [];

    for (const pair of pairs) {
      const layer = found.get(pair.node);

      if (layer === undefined) {
        missing.push(pair.node);
      } else {
        layers.push(this.#compared(layer, pair, tolerance, notes));
      }
    }

    const given = layers.every(({ notGiven }) => notGiven.length === 0);
    const differs = ({ mismatches }: LayerComparison) => mismatches.length > 0;

    return {
      layers: [...layers.filter(differs), ...layers.filter((layer) => !differs(layer))],
      missing,
      same: given && missing.length === 0 && !layers.some(differs),
      notes: [...notes, ...(given ? [] : [BUILD_STYLES_TEXT.notGiven])],
    };
  }

  /** Every layer of the reads by id; one another read holds in its parent wins over the read whose root it is. */
  #found(reads: readonly ReadModel[]): Map<string, FoundLayer> {
    const found = new Map<string, FoundLayer>();

    for (const model of reads) {
      const plan = this.#planner.plan(model);
      const { tokens, textStyles } = this.#catalogue.read(model, plan);
      const read = { model, plan, tokens, textStyles };
      const drawn = new Set<string>();

      for (const walked of this.#readLayers.walk(model.root)) {
        const { layer, parent } = walked;

        if (parent !== null && (drawn.has(parent.id) || plan.file(parent.id) !== undefined)) {
          drawn.add(layer.id);
        }

        if (parent !== null || !found.has(layer.id)) {
          found.set(layer.id, { ...walked, read, drawn: drawn.has(layer.id) });
        }
      }
    }

    return found;
  }

  #compared(
    { layer, parent, read, drawn }: FoundLayer,
    pair: StylePair,
    tolerance: number,
    notes: Set<string>,
  ): LayerComparison {
    const head = { node: pair.node, name: layer.name, ...(pair.label === undefined ? {} : { label: pair.label }) };

    if (!layer.visible || drawn) {
      notes.add(
        layer.visible ? BUILD_STYLES_TEXT.drawn(layer.name, layer.id) : BUILD_STYLES_TEXT.hidden(layer.name, layer.id),
      );

      return { ...head, tag: this.#builder.stub(layer).tag, matched: 0, mismatches: [], notGiven: [], notCompared: [] };
    }

    const { tag, attributes } = this.#builder.element(layer, read.model, parent, read.plan);
    const styles = {
      declarations: attributes.filter(([name]) => this.#css.has(name)),
      textStyle: attributes.find(([name]) => name === DESIGN_ATTRIBUTE.textStyle)?.[1],
      tokens: read.tokens,
      textStyles: read.textStyles,
    };

    return { ...head, tag, ...this.#check.compare(styles, pair.css, tolerance) };
  }
}

export const BUILD_STYLES = new InjectionToken<BuildStyles>("BuildStyles");
