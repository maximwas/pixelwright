import { InjectionToken, inject, injectable } from "@needle-di/core";
import { HINT_FIGMA, HINT_LABEL, OVERFLOW_SLACK } from "@/core/design/hints/hints.constants.ts";
import type { HintKind, LayerScope, ShownLayer } from "@/core/design/hints/hints.types.ts";
import { ALIKE_STRUCTURES } from "@/core/design/hints/structure/alike-structures.ts";
import { BAKED_PAINTS } from "@/core/design/hints/structure/baked-paints.ts";
import { SHARED_LAYERS } from "@/core/design/hints/structure/shared-layers.ts";
import {
  CHILDREN_MIN,
  REPEAT_MIN,
  ROOM_SLACK,
  SPACING_SLACK,
  STRUCTURE_AXES,
  STRUCTURE_FIGMA,
  STRUCTURE_TEXT,
} from "@/core/design/hints/structure/structure.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * The guide's structure rules (Q-001..Q-007) as hints, read on the layers' structure and never on their names: a
 * design shows the look, not the build. The per-layer kinds join LayerHints' table; `read` gives the hints on the read
 * as a whole.
 */
@injectable()
export class StructureHints {
  readonly #kinds: readonly HintKind[] = [
    { find: (scope) => this.#absolute(scope), say: STRUCTURE_TEXT.absolute },
    { find: (scope) => this.#spacer(scope), say: STRUCTURE_TEXT.spacer },
    { find: ({ layer }) => this.#forcedBreak(layer), say: STRUCTURE_TEXT.forcedBreak },
    { find: (scope) => this.#evenSpacing(scope), say: STRUCTURE_TEXT.evenSpacing },
    { find: (scope) => this.#fixedWidth(scope), say: STRUCTURE_TEXT.fixedWidth },
    { find: (scope) => this.#clipped(scope), say: STRUCTURE_TEXT.clipped },
  ];

  readonly #format;
  readonly #alike;
  readonly #shared;
  readonly #paints;

  constructor(
    format = inject(NUMBER_FORMAT),
    alike = inject(ALIKE_STRUCTURES),
    shared = inject(SHARED_LAYERS),
    paints = inject(BAKED_PAINTS),
  ) {
    this.#format = format;
    this.#alike = alike;
    this.#shared = shared;
    this.#paints = paints;
  }

  /** The kinds a shown layer is checked for, after LayerHints' own. */
  kinds(): readonly HintKind[] {
    return this.#kinds;
  }

  /** Structures built alike, top-level frames alike, baked fades and tiled textures. */
  read(layers: readonly ShownLayer[], root: ReadLayer): string[] {
    return [...this.#alike.read(layers), ...this.#shared.read(root), ...this.#paints.read(root)];
  }

  /** Children an auto layout parent places by hand, with the gap they keep where they stack evenly. */
  #absolute({ layer, children }: LayerScope): string | null {
    const placed = children.filter((child) => child.layoutPositioning === HINT_FIGMA.absolute);

    if (!this.#flows(layer) || placed.length < CHILDREN_MIN) {
      return null;
    }

    const gap = this.#gap(placed);

    return STRUCTURE_TEXT.absoluteExample(this.#label(layer), placed.length, gap === null ? null : this.#px(gap));
  }

  /** A layer in a flow that draws nothing and holds nothing: it is there for its size. */
  #spacer({ layer, parent }: LayerScope): string | null {
    const kind = layer.type === STRUCTURE_FIGMA.frame || layer.type === STRUCTURE_FIGMA.rectangle;
    const empty =
      layer.childCount === 0 &&
      !this.#draws(layer.fills) &&
      !this.#draws(layer.strokes) &&
      (layer.effects ?? []).length === 0;

    return kind && empty && parent !== null && this.#flows(parent) && layer.layoutPositioning !== HINT_FIGMA.absolute
      ? STRUCTURE_TEXT.spacerExample(this.#label(layer), this.#px(layer.width), this.#px(layer.height))
      : null;
  }

  /** A text that hugs its lines and breaks them itself: the breaks stand in for a width. */
  #forcedBreak(layer: ReadLayer): string | null {
    return layer.text?.textAutoResize === STRUCTURE_FIGMA.hugging &&
      layer.text.characters.includes(STRUCTURE_FIGMA.lineBreak)
      ? this.#label(layer)
      : null;
  }

  /** A frame placed by hand, with no guess from Figma, whose children keep one gap. */
  #evenSpacing({ layer, children }: LayerScope): string | null {
    const container = [HINT_FIGMA.frame, HINT_FIGMA.component, HINT_FIGMA.instance].some((type) => type === layer.type);

    if (
      !container ||
      layer.layoutMode !== undefined ||
      layer.inferredLayout !== undefined ||
      children.length < REPEAT_MIN
    ) {
      return null;
    }

    const gap = this.#gap(children);

    return gap === null ? null : STRUCTURE_TEXT.evenSpacingExample(this.#label(layer), this.#px(gap));
  }

  /** A text, or a frame of texts, of a fixed width narrower than the column it sits in. */
  #fixedWidth({ layer, parent, children }: LayerScope): string | null {
    if (
      parent?.layoutMode !== STRUCTURE_FIGMA.vertical ||
      layer.layoutPositioning === HINT_FIGMA.absolute ||
      (layer.layoutSizingHorizontal ?? STRUCTURE_FIGMA.fixed) !== STRUCTURE_FIGMA.fixed
    ) {
      return null;
    }

    const text = layer.type === STRUCTURE_FIGMA.text && layer.text?.textAutoResize !== STRUCTURE_FIGMA.hugging;
    const content =
      layer.type === STRUCTURE_FIGMA.frame && children.some((child) => child.type === STRUCTURE_FIGMA.text);
    const room = parent.width - (parent.paddingLeft ?? 0) - (parent.paddingRight ?? 0);

    return (text || content) && layer.width + ROOM_SLACK < room
      ? STRUCTURE_TEXT.fixedWidthExample(this.#label(layer), this.#px(layer.width), this.#px(room))
      : null;
  }

  /** A frame of fixed height that clips a text or a flow reaching past its bottom. */
  #clipped({ layer, children }: LayerScope): string | null {
    if (
      layer.clipsContent !== true ||
      (layer.layoutSizingVertical ?? STRUCTURE_FIGMA.fixed) !== STRUCTURE_FIGMA.fixed
    ) {
      return null;
    }

    const bottom = layer.y + layer.height + OVERFLOW_SLACK;
    const cut = children.find(
      (child) =>
        child.layoutPositioning !== HINT_FIGMA.absolute &&
        (child.type === STRUCTURE_FIGMA.text || child.layoutMode !== undefined) &&
        child.y + child.height > bottom,
    );

    return cut === undefined ? null : STRUCTURE_TEXT.clippedExample(this.#label(layer), this.#px(layer.height), cut.id);
  }

  /** The one gap the layers keep stacked down or across, or null when they keep none. */
  #gap(layers: readonly ReadLayer[]): number | null {
    for (const { start, size } of STRUCTURE_AXES) {
      const sorted = [...layers].sort((one, other) => one[start] - other[start]);
      const gaps = sorted.flatMap((layer, index) => {
        const next = sorted[index + 1];

        return next === undefined ? [] : [next[start] - layer[start] - layer[size]];
      });
      const [first] = gaps;

      if (
        first !== undefined &&
        first >= -SPACING_SLACK &&
        gaps.every((gap) => Math.abs(gap - first) <= SPACING_SLACK)
      ) {
        return Math.max(first, 0);
      }
    }

    return null;
  }

  #flows(layer: ReadLayer): boolean {
    return layer.layoutMode !== undefined && layer.layoutMode !== HINT_FIGMA.none;
  }

  #draws(value: ReadLayer["fills"]): boolean {
    return value !== undefined && (!Array.isArray(value) || value.some((paint) => paint.visible ?? true));
  }

  #label(layer: ReadLayer): string {
    return HINT_LABEL.layer(layer.id, layer.name);
  }

  #px(value: number): string {
    return HINT_LABEL.px(this.#format.round(value, PRECISION.box));
  }
}

export const STRUCTURE_HINTS = new InjectionToken<StructureHints>("StructureHints");
