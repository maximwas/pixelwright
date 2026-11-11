import { InjectionToken, inject, injectable } from "@needle-di/core";
import { INTERACTION_ATTRIBUTES } from "@/core/design/interactions/interaction-attributes.ts";
import {
  INSPECT_ALWAYS,
  INSPECT_GROUP_KEYS,
  INSPECT_NUMBER,
  INSPECT_TEXT,
  INSPECT_VALUE,
  TEXT_BREAKS,
} from "@/core/inspect/inspect.constants.ts";
import type { InspectAnswer, InspectLayerView } from "@/core/inspect/inspect.schema.ts";
import { INSPECT_FILLS } from "@/core/inspect/inspect-fills.ts";
import { INSPECT_LAYOUT } from "@/core/inspect/inspect-layout.ts";
import { Area, type Point } from "@/core/kernel/geometry/area.ts";
import { GEOMETRY } from "@/core/kernel/geometry/geometry.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { InspectedLayer, InspectRaw } from "@/shared/ops/inspect/inspect.schema.ts";
import { PROPERTY_KEY } from "@/shared/read-model/read-model.constants.ts";

type Box = InspectedLayer["box"];

type TextView = NonNullable<InspectLayerView["text"]>;

type Segment = NonNullable<InspectedLayer["text"]>["segments"][number];

/**
 * The inspect op's layers as the inspect tool's answer (A§9.3, T-080..T-083, K-059, K-060): boxes and centres in the
 * op's origin, the painted box when it differs, rotation, how far a layer overflows its parent's room, what paints it
 * (InspectFills), its auto layout as design_read's CSS longhands (InspectLayout), every effect as Figma has it, a
 * text's lines and line heights, its interactions, its variant and its properties with their defaults;
 * with `around`, each centre's distance and CSS rotate() angle from that point. Nothing here is guessed from CSS.
 */
@injectable()
export class InspectView {
  readonly #format;
  readonly #fills;
  readonly #sentences;
  readonly #layout;

  constructor(
    format = inject(NUMBER_FORMAT),
    fills = inject(INSPECT_FILLS),
    sentences = inject(INTERACTION_ATTRIBUTES),
    layout = inject(INSPECT_LAYOUT),
  ) {
    this.#format = format;
    this.#fills = fills;
    this.#sentences = sentences;
    this.#layout = layout;
  }

  build(
    raw: InspectRaw,
    around?: Point,
    fields?: readonly string[],
  ): InspectAnswer {
    return {
      relativeTo: raw.origin === null ? INSPECT_TEXT.page : INSPECT_TEXT.layer(raw.origin.id, raw.origin.name),
      ...(around === undefined ? {} : { around }),
      layers: raw.layers.map((layer) => this.#kept(this.#layer(layer, raw, around), fields)),
      missing: raw.missing,
      ...(raw.more === undefined ? {} : { more: raw.more, leftIds: raw.leftIds ?? [] }),
    };
  }

  /** Only the fields of the named groups, besides id, name and type; all without groups. */
  #kept(layer: InspectLayerView, fields: readonly string[] | undefined): InspectLayerView {
    if (fields === undefined) {
      return layer;
    }

    const keys = new Set<string>([...INSPECT_ALWAYS, ...fields.flatMap((group) => INSPECT_GROUP_KEYS[group] ?? [])]);

    return Object.fromEntries(Object.entries(layer).filter(([key]) => keys.has(key))) as InspectLayerView;
  }

  /** A box's centre, to 2 decimals: a turned layer's too, as its box bounds it (m:07ad610a). */
  centre(box: Box): Point {
    const { x, y } = new Area(box).centre();

    return { x: this.#round(x), y: this.#round(y) };
  }

  #layer(
    layer: InspectedLayer,
    raw: InspectRaw,
    around: Point | undefined,
  ): InspectLayerView {
    const { id, name, type, parent, box, paintedBox, rotation, effects = [], instance } = layer;
    const center = this.centre(box);

    return {
      id,
      name,
      type,
      parent,
      box,
      center,
      ...(layer.path === undefined || layer.path.length === 0 ? {} : { path: layer.path }),
      ...(around === undefined ? {} : this.#bearing(around, center)),
      ...(paintedBox === null || this.#same(paintedBox, box) ? {} : { paintedBox }),
      ...(rotation === undefined || rotation === 0 ? {} : { rotation }),
      ...this.#overflow(layer),
      ...this.#fills.read(layer, raw),
      ...this.#layout.read(layer),
      ...this.#layout.parent(layer),
      ...(effects.length === 0 ? {} : { effects }),
      ...this.#text(layer, raw),
      ...this.#interactions(layer),
      ...(instance === undefined ? {} : { component: this.#component(instance, layer.defaults ?? {}) }),
    };
  }

  /**
   * How far a centre lies from a point and its direction as a CSS rotate() turn (K-060): 0 up, clockwise, y down. The
   * angle is rounded after the modulo (B-034: 0.19 came back 0.18999999999999773), and the last modulo turns 359.999,
   * rounded to 360, into 0. No angle at the point itself.
   */
  #bearing(from: Point, to: Point): Pick<InspectLayerView, "distance" | "angle"> {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = this.#round(Math.hypot(dx, dy));

    if (distance === 0) {
      return { distance };
    }

    const degrees = (Math.atan2(dx, -dy) * GEOMETRY.halfTurnDegrees) / Math.PI;
    const { turn } = INSPECT_NUMBER;

    return { distance, angle: this.#format.round((degrees + turn) % turn, PRECISION.angle) % turn };
  }

  #same(first: Box, second: Box): boolean {
    return [first.x - second.x, first.y - second.y, first.width - second.width, first.height - second.height].every(
      (difference) => Math.abs(difference) <= INSPECT_NUMBER.same,
    );
  }

  /** How far the box reaches past its parent's room: the parent's box less the padding of its auto layout. */
  #overflow({ box, parentBox, parentPadding, layoutPositioning }: InspectedLayer): Pick<InspectLayerView, "overflow"> {
    if (parentBox === null || layoutPositioning === INSPECT_VALUE.absolute) {
      return {};
    }

    const padding = parentPadding ?? INSPECT_VALUE.noPadding;
    const sides = {
      left: parentBox.x + padding.left - box.x,
      right: box.x + box.width - (parentBox.x + parentBox.width - padding.right),
      top: parentBox.y + padding.top - box.y,
      bottom: box.y + box.height - (parentBox.y + parentBox.height - padding.bottom),
    };
    const past = Object.entries(sides).filter(([, value]) => value > INSPECT_NUMBER.past);

    return past.length === 0
      ? {}
      : { overflow: Object.fromEntries(past.map(([side, value]) => [side, this.#round(value)])) };
  }

  /** A text's lines, its distinct line heights and font sizes, how it resizes, its paragraph spacing. */
  #text(layer: InspectedLayer, raw: InspectRaw): Pick<InspectLayerView, "text"> {
    const { text } = layer;

    if (text === undefined) {
      return {};
    }

    const { segments, paragraphSpacing } = text;

    return {
      text: {
        lines: this.#lines(text.characters),
        lineHeights: [...new Set(segments.map((segment) => this.#lineHeight(segment)))],
        fontSizes: [...new Set(segments.map(({ fontSize }) => fontSize))],
        autoResize: text.textAutoResize,
        ...(segments.length > 1 ? { segments: segments.map((segment) => this.#run(segment, layer, raw)) } : {}),
        ...(typeof paragraphSpacing === "number" && paragraphSpacing !== 0 ? { paragraphSpacing } : {}),
      },
    };
  }

  /** One run of a text that mixes styles. */
  #run(
    segment: Segment,
    layer: InspectedLayer,
    raw: InspectRaw,
  ): NonNullable<TextView["segments"]>[number] {
    const { start, end, characters, fontName, fontSize, textDecoration } = segment;
    const fill = this.#fills.runFill(segment, layer, raw);

    return {
      start,
      end,
      characters,
      fontFamily: fontName.family,
      fontStyle: fontName.style,
      fontSize,
      textDecoration,
      ...(fill === undefined ? {} : { fill }),
    };
  }

  /** A text's lines, each with what ended it: Shift+Enter a line, Enter a paragraph; the last none. */
  #lines(characters: string): TextView["lines"] {
    const lines: TextView["lines"] = [];
    let current = "";

    for (const char of characters) {
      const ended = TEXT_BREAKS[char];

      if (ended === undefined) {
        current += char;
      } else {
        lines.push({ text: current, break: ended });
        current = "";
      }
    }

    return [...lines, { text: current, break: null }];
  }

  /** A run's line height: px, a percent with the px it makes, or auto. */
  #lineHeight({ lineHeight: { unit, value }, fontSize }: Segment): string {
    if (value === undefined) {
      return INSPECT_TEXT.auto;
    }

    const px = (pixels: number) => INSPECT_TEXT.px(this.#format.round(pixels, PRECISION.textSpacing));

    if (unit === INSPECT_VALUE.pixels) {
      return px(value);
    }

    return unit === INSPECT_VALUE.percent
      ? INSPECT_TEXT.percent(
        this.#format.round(value, PRECISION.decimal),
        px((fontSize * value) / INSPECT_NUMBER.percent),
      )
      : INSPECT_TEXT.auto;
  }

  /** Each prototype interaction: its trigger, the sentence design_read's attribute holds, and Figma's reaction. */
  #interactions({ reactions = [] }: InspectedLayer): Pick<InspectLayerView, "interactions"> {
    return reactions.length === 0
      ? {}
      : {
        interactions: reactions.map((reaction) => ({
          trigger: reaction.trigger?.type ?? INSPECT_VALUE.noTrigger,
          summary: this.#sentences.sentence(reaction),
          reaction,
        })),
      };
  }

  /**
   * An instance's component: its name, its set's, its variant's values, and every property by name (Figma's #id left
   * out) with its value and the component's default.
   */
  #component({ componentName, setName, properties }: NonNullable<InspectedLayer["instance"]>,    defaults: NonNullable<InspectedLayer["defaults"]>): NonNullable<InspectLayerView["component"]> {
    return {
      name: componentName,
      ...(setName === undefined ? {} : { set: setName }),
      variant: Object.fromEntries(
        Object.entries(properties)
          .filter(([, property]) => property.type === INSPECT_VALUE.variant)
          .map(([key, property]) => [key, String(property.value)]),
      ),
      properties: Object.fromEntries(
        Object.entries(properties).map(([key, { type, value }]) => [
          PROPERTY_KEY.name(key),
          { type, value, ...(Object.hasOwn(defaults, key) ? { default: defaults[key] } : {}) },
        ]),
      ),
    };
  }

  #round(value: number): number {
    return this.#format.round(value, PRECISION.distance);
  }
}

export const INSPECT_VIEW = new InjectionToken<InspectView>("InspectView");
