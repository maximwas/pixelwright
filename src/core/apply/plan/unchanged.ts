import { InjectionToken, inject, injectable } from "@needle-di/core";
import { isEqual } from "es-toolkit";
import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import type { ApplyElement } from "@/core/apply/apply.types.ts";
import { PLAN_VALUE, UNCHANGED_PATTERN, UNCHANGED_READ_AS, UNCHANGED_VALUE } from "@/core/apply/plan/plan.constants.ts";
import type { LayerEntry, LayerNow } from "@/core/apply/plan/plan.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FIGMA_PAINT } from "@/core/css/paints/paints.constants.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { WRITE_REGISTRY } from "@/core/css/registry/write-registry.ts";
import { CSS_URL } from "@/core/css/values/css-url.ts";
import type { AssetPlan } from "@/core/design/assets/asset-plan.ts";
import { ASSET_PLANNER } from "@/core/design/assets/asset-planner.ts";
import { DESIGN_BUILDER } from "@/core/design/builder/design-builder.ts";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import { Color, type ColorSpace } from "@/core/kernel/color/color.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A layer's element as design_read writes it: attribute by name. */
type Render = ReadonlyMap<string, string>;

/** What an element's attributes are compared with: its tag, the layer's renders, the file's space, its visibility. */
interface Compared {
  readonly tag: string;
  readonly renders: readonly Render[];
  readonly space: ColorSpace;
  readonly visible: boolean;
}

/**
 * Which of an element's attributes the layer already has, judged in CSS space (D-19, C-170): the layer is rendered
 * once per call as design_read writes its element (the reader's rounding included), and an attribute is held when it
 * reads the same, or when the write half of its property group makes the same Figma properties of both (another
 * spelling of the same colour or border), or in a Display P3 file when its sRGB colours as P3 values do. A top-level
 * element is compared with the layer as the read's root and as its parent's child, since design_read writes either; a
 * nested one only as its parent holds it. A hidden layer is rendered as shown, so what it has is known when it is
 * shown again; a file's src is held (the server compares its bytes, C-149).
 */
@injectable()
export class Unchanged {
  readonly #builder;
  readonly #assets;
  readonly #registry;
  readonly #urls;
  /** Each call's entries and reads are its own (CurrentLayers), so these live as long as one call. */
  readonly #renders = new WeakMap<LayerEntry, Map<ReadLayer | null, Render>>();
  readonly #plans = new WeakMap<ReadModel, AssetPlan>();

  constructor(
    builder = inject(DESIGN_BUILDER),
    assets = inject(ASSET_PLANNER),
    registry = inject(WRITE_REGISTRY),
    urls = inject(CSS_URL),
  ) {
    this.#builder = builder;
    this.#assets = assets;
    this.#registry = registry;
    this.#urls = urls;
  }

  of(element: ApplyElement, entry: LayerEntry): LayerNow {
    const { layer, parent, model } = entry;
    const nested = element.parent !== null && parent !== null;
    const parents = nested || parent === null ? [parent] : [null, parent];
    const renders = parents.map((holder) => this.#render(entry, holder));
    const compared: Compared = {
      tag: element.tag,
      renders,
      space: model.colorProfile === FIGMA_PAINT.displayP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb,
      visible: layer.visible,
    };
    const attributes = new Set(
      Object.entries(element.attributes)
        .filter(([name, given]) => this.#held(name, given, compared))
        .map(([name]) => name),
    );
    const wanted = element.content?.map(({ value }) => value).join("");
    // As its parent holds it when it has one: that render places it.
    const shown = [...(renders.at(-1) ?? [])];

    return {
      attributes,
      text: wanted === undefined || layer.text?.characters === wanted,
      visible: layer.visible,
      current: Object.fromEntries(
        shown.filter(([name]) => name !== ATTRIBUTE.id && !name.startsWith(UNCHANGED_VALUE.readOnly)),
      ),
    };
  }

  #held(
    name: string,
    given: string,
    compared: Compared,
  ): boolean {
    if (name === ATTRIBUTE.src) {
      return true;
    }

    if (name === CSS_PROPERTY.display && !compared.visible) {
      // Rendered as shown, but its display is none now: any other display shows it.
      return given.trim() === PLAN_VALUE.none;
    }

    const read = Object.hasOwn(UNCHANGED_READ_AS, name) ? (UNCHANGED_READ_AS[name] ?? name) : name;
    const values = [given, this.#inSpace(given, compared.space)];

    return compared.renders.some((render) => {
      const written = render.get(read);

      return (
        written !== undefined && values.some((value) => this.#same(name, written, value, { tag: compared.tag, render }))
      );
    });
  }

  /** Equal as text, as a background without its files' names, or as the Figma properties its writer makes. */
  #same(
    name: string,
    written: string,
    value: string,
    scope: { readonly tag: string; readonly render: Render },
  ): boolean {
    if (written === value) {
      return true;
    }

    if (name === CSS_PROPERTY.background && this.#urls.withoutUrls(written) === this.#urls.withoutUrls(value)) {
      return true;
    }

    if (!this.#registry.owns(name)) {
      return false;
    }

    const held = this.#written(name, written, scope);

    return held !== null && isEqual(held, this.#written(name, value, scope));
  }

  /** What the writers make of one attribute over the rest of the layer's render; null when it is an error. */
  #written(
    name: string,
    value: string,
    { tag, render }: { readonly tag: string; readonly render: Render },
  ): FigmaProps | null {
    const out = new ChangeOutput();

    this.#registry.write(
      {
        tag,
        own: (attribute) => (attribute === name ? value : undefined),
        merged: (attribute) => (attribute === name ? value : render.get(attribute)),
        changed: (attribute) => attribute === name,
        hidden: false,
        existing: true,
      },
      out,
    );

    return out.problems.length > 0 ? null : out.props;
  }

  /** A value with its sRGB colours as a Display P3 file holds them; an sRGB file's values are as given. */
  #inSpace(value: string, space: ColorSpace): string {
    if (space === COLOR_SPACE.srgb) {
      return value;
    }

    return value.replace(UNCHANGED_PATTERN.srgb, (literal) => Color.parse(literal)?.to(space).css() ?? literal);
  }

  /** The layer's element as design_read writes it inside `parent` (null: as the read's root), once per call. */
  #render(entry: LayerEntry, parent: ReadLayer | null): Render {
    const renders = this.#renders.get(entry) ?? new Map<ReadLayer | null, Render>();
    const held = renders.get(parent);

    this.#renders.set(entry, renders);

    if (held !== undefined) {
      return held;
    }

    const { layer, model } = entry;
    const shown = layer.visible ? layer : { ...layer, visible: true };
    const plan = this.#plans.get(model) ?? this.#assets.plan(model);
    const render = new Map(this.#builder.element(shown, model, parent, plan).attributes);

    this.#plans.set(model, plan);
    renders.set(parent, render);

    return render;
  }
}

export const UNCHANGED = new InjectionToken<Unchanged>("Unchanged");
