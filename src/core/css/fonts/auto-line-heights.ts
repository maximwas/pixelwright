import { InjectionToken, inject, injectable } from "@needle-di/core";
import { AUTO_LINE_HEIGHT } from "@/core/css/fonts/fonts.constants.ts";
import type { TextSegment } from "@/core/css/groups/text/text-run.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Style = ReadModel["styles"][string];

/**
 * design_read's `autoLineHeight: "px"` (T-060, B-038, FX-042): the read with each Auto line height Figma renders at a
 * px the read can tell written as that px, in the texts' runs and the text styles alike; the rest stay Auto (normal),
 * and the hint on Auto line heights names only them. Figma sizes a text that hugs its lines by them: in one font and
 * size, with nothing between its lines (no leading trim, paragraph or list spacing), it is as tall as its lines, and
 * every text in that font and size has lines that tall. The first such text of a font and size gives it.
 */
@injectable()
export class AutoLineHeights {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  px(model: ReadModel): ReadModel {
    const found = new Map<string, number>();

    this.#find(model.root, found);

    return {
      ...model,
      root: this.#layer(model.root, found),
      styles: Object.fromEntries(Object.entries(model.styles).map(([id, style]) => [id, this.#style(style, found)])),
    };
  }

  #find(layer: ReadLayer, found: Map<string, number>): void {
    const [first] = layer.text?.segments ?? [];

    if (first !== undefined && this.#hugs(layer, first) && !found.has(this.#key(first))) {
      const lines = (layer.text?.characters ?? "").split(AUTO_LINE_HEIGHT.lineBreak).length;

      found.set(this.#key(first), this.#format.round(layer.height / lines, PRECISION.textSpacing));
    }

    for (const child of layer.children ?? []) {
      this.#find(child, found);
    }
  }

  /** A text whose height is its lines' alone: it hugs them, in one font and size, Auto, nothing between. */
  #hugs(layer: ReadLayer, first: TextSegment): boolean {
    const { text } = layer;

    return (
      layer.type === AUTO_LINE_HEIGHT.text &&
      text?.textAutoResize === AUTO_LINE_HEIGHT.hugs &&
      text.leadingTrim === undefined &&
      text.paragraphSpacing === undefined &&
      text.listSpacing === undefined &&
      text.segments.every(
        (segment) => segment.lineHeight.unit === AUTO_LINE_HEIGHT.auto && this.#key(segment) === this.#key(first),
      )
    );
  }

  #layer(layer: ReadLayer, found: ReadonlyMap<string, number>): ReadLayer {
    const text =
      layer.text === undefined
        ? {}
        : { text: { ...layer.text, segments: layer.text.segments.map((segment) => this.#segment(segment, found)) } };
    const children =
      layer.children === undefined ? {} : { children: layer.children.map((child) => this.#layer(child, found)) };

    return { ...layer, ...text, ...children };
  }

  #segment(segment: TextSegment, found: ReadonlyMap<string, number>): TextSegment {
    const px = found.get(this.#key(segment));

    return segment.lineHeight.unit === AUTO_LINE_HEIGHT.auto && px !== undefined
      ? { ...segment, lineHeight: { unit: AUTO_LINE_HEIGHT.pixels, value: px } }
      : segment;
  }

  #style(style: Style, found: ReadonlyMap<string, number>): Style {
    const { fontName, fontSize, lineHeight } = style;
    const px =
      fontName === undefined || fontSize === undefined ? undefined : found.get(this.#key({ fontName, fontSize }));

    return lineHeight?.unit === AUTO_LINE_HEIGHT.auto && px !== undefined
      ? { ...style, lineHeight: { unit: AUTO_LINE_HEIGHT.pixels, value: px } }
      : style;
  }

  /** What an Auto line height depends on: the font's family and style, and its size. */
  #key({ fontName, fontSize }: Pick<TextSegment, "fontName" | "fontSize">): string {
    return JSON.stringify([fontName.family, fontName.style, fontSize]);
  }
}

export const AUTO_LINE_HEIGHTS = new InjectionToken<AutoLineHeights>("AutoLineHeights");
