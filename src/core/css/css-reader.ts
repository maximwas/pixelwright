import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CssDeclarations, type LayerCss } from "@/core/css/registry/css-declarations.ts";
import { GROUP_REGISTRY } from "@/core/css/registry/group-registry.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** The CSS domain's facade: a layer's CSS from its read-model fields, through every property group in order. */
@injectable()
export class CssReader {
  readonly #registry;

  constructor(registry = inject(GROUP_REGISTRY)) {
    this.#registry = registry;
  }

  /** `parent` decides how the layer sits (flowing in auto layout, or placed); null for the read's root. */
  read(
    layer: ReadLayer,
    parent: ReadLayer | null,
    model: ReadModel,
  ): LayerCss {
    const css = new CssDeclarations();

    this.#registry.read({ layer, parent, model, css });

    return css.build();
  }
}

export const CSS_READER = new InjectionToken<CssReader>("CssReader");
