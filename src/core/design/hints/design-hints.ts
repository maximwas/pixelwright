import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSET_CLASSIFIER } from "@/core/design/assets/asset-classifier.ts";
import type { ShownLayer } from "@/core/design/hints/hints.types.ts";
import { INFERRED_HINTS } from "@/core/design/hints/inferred-hints.ts";
import { LAYER_HINTS } from "@/core/design/hints/layer-hints.ts";
import { TOKEN_HINTS } from "@/core/design/hints/token-hints.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * The JSON block's hints (T-061): what Figma does not bind and the code should, one per kind with a count and three
 * examples: the token hints, the layers' own, then Figma's variable matches. Hints never change the XML.
 */
@injectable()
export class DesignHints {
  readonly #readLayers = new ReadLayers();
  readonly #layers;
  readonly #tokens;
  readonly #inferred;
  readonly #classifier;

  constructor(
    layers = inject(LAYER_HINTS),
    tokens = inject(TOKEN_HINTS),
    inferred = inject(INFERRED_HINTS),
    classifier = inject(ASSET_CLASSIFIER),
  ) {
    this.#layers = layers;
    this.#tokens = tokens;
    this.#inferred = inferred;
    this.#classifier = classifier;
  }

  /** `tree`: the read as built; `tokens`: the JSON block's. */
  read(
    model: ReadModel,
    tree: XmlElement | null,
    tokens: Readonly<Record<string, string>>,
  ): string[] {
    // Every visible layer that is no asset, in document order: hints speak of the design, branches the read cut to fit
    // included; an asset is one file, and how it is built never reaches the code.
    const shown: ShownLayer[] = [
      ...this.#readLayers.walk(
        model.root,
        (layer) => layer.visible && this.#classifier.classify(layer, model.root) === null,
      ),
    ];

    return [
      ...this.#tokens.read(model, tree, tokens),
      ...this.#layers.read(shown, model.root),
      ...this.#inferred.read(
        model,
        shown.map(({ layer }) => layer),
      ),
    ];
  }
}

export const DESIGN_HINTS = new InjectionToken<DesignHints>("DesignHints");
