import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { PADDING_FIELDS } from "@/core/css/groups/layout/layout.constants.ts";
import { LAYOUT_GROUP } from "@/core/css/groups/layout/layout-group.ts";
import { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { INSPECT_PADDING } from "@/core/inspect/inspect.constants.ts";
import type { InspectLayerView } from "@/core/inspect/inspect.schema.ts";
import type { InspectedLayer } from "@/shared/ops/inspect/inspect.schema.ts";
import { READ_MODEL, READ_PROFILE } from "@/shared/read-model/read-model.constants.ts";

type Layout = NonNullable<InspectLayerView["layout"]>;

/**
 * A layer's auto layout or grid for inspect: design_read's own mapping (LayoutGroup, one source) with its names and gap
 * rules, the padding as its four longhands and every length as a px number. The read passes no variables, so a bound
 * length reads as its number: its token is in `bound`.
 */
@injectable()
export class InspectLayout {
  readonly #group;
  readonly #lengths;

  constructor(group = inject(LAYOUT_GROUP), lengths = inject(CSS_LENGTH)) {
    this.#group = group;
    this.#lengths = lengths;
  }

  read(layer: InspectedLayer): Pick<InspectLayerView, "layout"> {
    const css = new CssDeclarations();

    this.#group.read({
      layer,
      parent: null,
      css,
      model: { model: READ_MODEL.version, profile: READ_PROFILE.inspect, root: layer, styles: {}, variables: {} },
    });

    const entries = css
      .build()
      .properties.flatMap(([property, value]) =>
        property === CSS_PROPERTY.padding ? this.#sides(layer) : [[property, this.#number(value)] as const],
      );

    return entries.length === 0 ? {} : { layout: Object.fromEntries(entries) };
  }

  /** The auto layout or grid of the parent that places the layer, as read() gives a layer's own. */
  parent(layer: InspectedLayer): Pick<InspectLayerView, "parentLayout"> {
    const { id, name, type, visible, x, y, width, height, parentLayout } = layer;

    if (parentLayout === undefined) {
      return {};
    }

    const box = { x, y, width, height };
    const { layout } = this.read({
      id,
      name,
      type,
      visible,
      ...box,
      parent: null,
      box,
      paintedBox: null,
      parentBox: null,
      parentPadding: null,
      ...parentLayout,
    });

    return layout === undefined ? {} : { parentLayout: layout };
  }

  /** Each padding side under its longhand, 0 included. */
  #sides(layer: InspectedLayer): (readonly [string, Layout[string]])[] {
    return PADDING_FIELDS.map(
      (field, index) => [INSPECT_PADDING[index] ?? field, this.#number(this.#lengths.px(layer[field] ?? 0))] as const,
    );
  }

  /** A px length as its number; any other value (flex, wrap, a grid's tracks) as CSS writes it. */
  #number(value: string): Layout[string] {
    const length = this.#lengths.length(value);

    return typeof length === "number" ? length : value;
  }
}

export const INSPECT_LAYOUT = new InjectionToken<InspectLayout>("InspectLayout");
