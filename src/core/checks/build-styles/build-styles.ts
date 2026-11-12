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
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
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
 * the build's computed styles against it, in its parent: another pair's read's, else its own read's ancestors' (its own
 * read's root with neither: its size, not its place). A hidden root is compared as shown, since the read op reads it
 * whole; a hidden layer below a root (a stub, D-18) and one an icon or an image draws are noted, not compared. Layers
 * with differences come first.
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

  /**
   * Every layer of the reads by id. One another read holds in its parent wins over the read whose root it is, unless it
   * is a hidden stub there; a root sits in the first of its read's ancestors, its parent.
   */
  #found(reads: readonly ReadModel[]): Map<string, FoundLayer> {
    const found = new Map<string, FoundLayer>();

    for (const read of reads) {
      const planned = this.#planned(read);
      const { model, plan } = planned;
      const drawn = new Set<string>();

      for (const { layer, parent } of this.#readLayers.walk(model.root)) {
        if (parent !== null && (drawn.has(parent.id) || plan.file(parent.id) !== undefined)) {
          drawn.add(layer.id);
        }

        if (this.#wins(found.get(layer.id), layer, parent)) {
          const placed = parent ?? model.ancestors?.[0] ?? null;

          found.set(layer.id, { layer, parent: placed, read: planned, drawn: drawn.has(layer.id) });
        }
      }
    }

    return found;
  }

  /** A read with what its layers' CSS needs; a hidden root as shown, since the read op reads it whole (T-090). */
  #planned(read: ReadModel): PlannedRead {
    const model = read.root.visible ? read : { ...read, root: { ...read.root, visible: true } };
    const plan = this.#planner.plan(model);
    const { tokens, textStyles } = this.#catalogue.read(model, plan);

    return { model, plan, tokens, textStyles };
  }

  /** Whether a layer's entry here beats the one held: in a parent over a root, a whole entry over a stub. */
  #wins(
    held: FoundLayer | undefined,
    layer: ReadLayer,
    parent: ReadLayer | null,
  ): boolean {
    return held === undefined || (parent === null ? !held.layer.visible : layer.visible);
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
