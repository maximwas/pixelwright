import { InjectionToken, inject, injectable } from "@needle-di/core";
import { COMPONENT_ATTRIBUTES } from "@/core/design/component/component-attributes.ts";
import {
  BACKGROUND_SLACK,
  DEFAULT_NAME,
  EXAMPLES,
  HINT_FIGMA,
  HINT_LABEL,
  HINT_TEXT,
  OVERFLOW_SLACK,
  TURN_SLACK,
} from "@/core/design/hints/hints.constants.ts";
import { LAYOUT_GUESS } from "@/core/design/hints/layout-guess.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A layer the read shows as a layer, with the parent it sits in. */
export interface ShownLayer {
  readonly layer: ReadLayer;
  readonly parent: ReadLayer | null;
}

/** What a hint looks at on a layer: the layer, its parent, the read's root and the layer's shown children. */
interface LayerScope extends ShownLayer {
  readonly root: ReadLayer;
  readonly children: readonly ReadLayer[];
}

/** A kind of hint about layers: the example a layer gives of it (null for none), and the hint for all of them. */
interface HintKind {
  readonly find: (scope: LayerScope) => string | null;
  readonly say: (examples: readonly string[]) => string;
}

/**
 * The hints about the read's own layers (C-151), one per kind however many layers it is about: default names, then
 * the kinds in the order a layer is checked for them (a hint comes where its first layer does), then missing fonts.
 */
@injectable()
export class LayerHints {
  readonly #attributes;
  readonly #guess;
  readonly #format;
  readonly #kinds: readonly HintKind[] = [
    { find: (scope) => this.#manual(scope), say: HINT_TEXT.manual },
    { find: (scope) => this.#overridden(scope), say: HINT_TEXT.overridden },
    { find: (scope) => this.#background(scope), say: HINT_TEXT.background },
    { find: (scope) => this.#wrapper(scope), say: HINT_TEXT.wrapper },
    { find: (scope) => this.#centredStroke(scope), say: HINT_TEXT.centredStroke },
    { find: ({ layer }) => ((layer.detached ?? false) ? this.#label(layer) : null), say: HINT_TEXT.detached },
    { find: (scope) => this.#autoLineHeight(scope), say: HINT_TEXT.autoLineHeight },
    { find: (scope) => this.#softBreak(scope), say: HINT_TEXT.softBreak },
    { find: (scope) => this.#overflow(scope), say: HINT_TEXT.overflow },
  ];

  constructor(
    attributes = inject(COMPONENT_ATTRIBUTES),
    guess = inject(LAYOUT_GUESS),
    format = inject(NUMBER_FORMAT),
  ) {
    this.#attributes = attributes;
    this.#guess = guess;
    this.#format = format;
  }

  read(layers: readonly ShownLayer[], root: ReadLayer): string[] {
    const found = new Map<HintKind, string[]>();

    for (const { layer, parent } of layers) {
      const scope: LayerScope = {
        layer,
        parent,
        root,
        children: (layer.children ?? []).filter((child) => child.visible),
      };

      for (const kind of this.#kinds) {
        const example = kind.find(scope);

        if (example !== null) {
          found.set(kind, [...(found.get(kind) ?? []), example]);
        }
      }
    }

    const nodes = layers.map(({ layer }) => layer);

    return [
      ...this.#defaultNames(nodes),
      ...[...found].map(([kind, examples]) => kind.say(examples)),
      ...this.#missingFonts(nodes),
    ];
  }

  /** Layers left with the names Figma gave them. */
  #defaultNames(layers: readonly ReadLayer[]): string[] {
    const unnamed = layers.filter((layer) => DEFAULT_NAME.test(layer.name));
    const examples = unnamed
      .slice(0, EXAMPLES)
      .map((layer) => this.#label(layer))
      .join(HINT_TEXT.examples);

    if (unnamed.length === 0) {
      return [];
    }

    return [unnamed.length === 1 ? HINT_TEXT.defaultName(examples) : HINT_TEXT.defaultNames(unnamed.length, examples)];
  }

  /** Texts whose fonts this machine lacks: Figma laid them out with something else. */
  #missingFonts(layers: readonly ReadLayer[]): string[] {
    const missing = layers.filter((layer) => layer.missingFont ?? false);
    const families = [
      ...new Set(missing.flatMap((layer) => layer.text?.segments.map((segment) => segment.fontName.family) ?? [])),
    ];
    const examples = missing
      .slice(0, EXAMPLES)
      .map((layer) => this.#label(layer))
      .join(HINT_TEXT.examples);

    return missing.length === 0 ? [] : [HINT_TEXT.missingFonts(families, examples)];
  }

  /** A frame, component or instance placing two children or more by hand, with Figma's guess at its flow. */
  #manual({ layer, children }: LayerScope): string | null {
    const container = [HINT_FIGMA.frame, HINT_FIGMA.component, HINT_FIGMA.instance].some((type) => type === layer.type);

    if (!container || layer.layoutMode !== undefined || children.length < 2) {
      return null;
    }

    const guess = layer.inferredLayout === undefined ? null : this.#guess.css(layer.inferredLayout, children.length);

    return HINT_TEXT.manualExample(this.#label(layer), children.length, guess);
  }

  #overridden({ layer }: LayerScope): string | null {
    const words = this.#attributes.override(layer);

    return words === undefined ? null : HINT_TEXT.overriddenExample(this.#label(layer), words);
  }

  /** A rectangle with a plain fill under the rest, the size of its parent: a background drawn as a layer. */
  #background({ layer, children }: LayerScope): string | null {
    const [first] = children;

    if (first === undefined || children.length < 2) {
      return null;
    }

    const placed = layer.layoutMode === undefined || first.layoutPositioning === HINT_FIGMA.absolute;
    const solid =
      Array.isArray(first.fills) &&
      first.fills.length > 0 &&
      first.fills.every((paint) => paint.type === HINT_FIGMA.solid);
    const close = (one: number, other: number) => Math.abs(one - other) <= BACKGROUND_SLACK;
    const covers =
      close(first.x, layer.x) &&
      close(first.y, layer.y) &&
      close(first.width, layer.width) &&
      close(first.height, layer.height);

    return first.type === HINT_FIGMA.rectangle && placed && solid && covers
      ? HINT_TEXT.backgroundExample(this.#label(first), this.#label(layer))
      : null;
  }

  /** A frame that draws nothing and spaces nothing around its one layer. */
  #wrapper({ layer, parent, root, children }: LayerScope): string | null {
    const paints = (value: ReadLayer["fills"]) => value !== undefined && (!Array.isArray(value) || value.length > 0);
    const padded = [layer.paddingTop, layer.paddingRight, layer.paddingBottom, layer.paddingLeft].some(
      (side) => (side ?? 0) > 0,
    );
    const bare =
      !paints(layer.fills) &&
      !paints(layer.strokes) &&
      (layer.effects ?? []).length === 0 &&
      !padded &&
      layer.clipsContent !== true;
    const [child] = children;

    return layer.type === HINT_FIGMA.frame &&
      layer !== root &&
      child !== undefined &&
      children.length === 1 &&
      layer.childCount === 1 &&
      bare &&
      parent !== null
      ? HINT_TEXT.wrapperExample(this.#label(layer), child.id)
      : null;
  }

  #centredStroke({ layer }: LayerScope): string | null {
    const stroked = (layer.strokes ?? []).some((paint) => paint.visible ?? true);

    return layer.strokeAlign === HINT_FIGMA.center && stroked ? this.#label(layer) : null;
  }

  /** A text on a path has no line height: Figma reads its segments as Auto all the same. */
  #autoLineHeight({ layer }: LayerScope): string | null {
    const auto = (layer.text?.segments ?? []).some((segment) => segment.lineHeight.unit === HINT_FIGMA.auto);

    return layer.type === HINT_FIGMA.text && auto ? this.#label(layer) : null;
  }

  #softBreak({ layer }: LayerScope): string | null {
    return (layer.text?.characters ?? "").includes(HINT_FIGMA.softBreak) ? this.#label(layer) : null;
  }

  /** A layer in a flow wider, or else taller, than the room its parent gives it; a turned one's box is not its size. */
  #overflow({ layer, parent }: LayerScope): string | null {
    if (
      parent === null ||
      parent.layoutMode === undefined ||
      parent.layoutMode === HINT_FIGMA.none ||
      layer.layoutPositioning === HINT_FIGMA.absolute ||
      Math.abs(layer.rotation ?? 0) >= TURN_SLACK
    ) {
      return null;
    }

    const width = parent.width - (parent.paddingLeft ?? 0) - (parent.paddingRight ?? 0);
    const height = parent.height - (parent.paddingTop ?? 0) - (parent.paddingBottom ?? 0);

    if (layer.width > width + OVERFLOW_SLACK) {
      return HINT_TEXT.wide(this.#label(layer), this.#px(layer.width), this.#px(width));
    }

    return layer.height > height + OVERFLOW_SLACK
      ? HINT_TEXT.tall(this.#label(layer), this.#px(layer.height), this.#px(height))
      : null;
  }

  #label(layer: ReadLayer): string {
    return HINT_LABEL.layer(layer.id, layer.name);
  }

  #px(value: number): string {
    return HINT_LABEL.px(this.#format.round(value, PRECISION.box));
  }
}

export const LAYER_HINTS = new InjectionToken<LayerHints>("LayerHints");
