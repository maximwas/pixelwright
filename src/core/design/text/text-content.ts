import { InjectionToken, inject, injectable } from "@needle-di/core";
import { type RunCss, TEXT_RUN, type TextSegment } from "@/core/css/groups/text/text-run.ts";
import { SPAN_RESETS, TEXT_CONTENT } from "@/core/design/text/text.constants.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { XmlAttribute, XmlContent } from "@/core/xml/xml.types.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * A Text's content (C-120): its characters, the runs that differ from its main one as Spans with only what differs
 * (and the resets of the main one's spacing, case or decoration); with a character limit, its first characters and `…`.
 */
@injectable()
export class TextContent {
  readonly #runs;

  constructor(runs = inject(TEXT_RUN)) {
    this.#runs = runs;
  }

  content(
    layer: ReadLayer,
    model: ReadModel,
    limit?: number,
  ): XmlContent[] {
    const characters = layer.text?.characters ?? "";

    if (limit !== undefined) {
      return [...this.#pieces(characters.slice(0, limit)), { kind: XML_CONTENT.text, value: TEXT_CONTENT.ellipsis }];
    }

    const segments = layer.text?.segments ?? [];
    const base = this.#runs.base(segments);

    if (base === undefined || segments.length < 2) {
      return this.#pieces(characters);
    }

    const main = this.#runs.read(base, model);

    return segments.flatMap((segment) =>
      segment === base ? this.#pieces(segment.characters) : this.#span(segment, base, main, model),
    );
  }

  /** A run as a Span with what it sets over the main run; plain characters when it sets nothing else. */
  #span(
    segment: TextSegment,
    base: TextSegment,
    main: RunCss,
    model: ReadModel,
  ): XmlContent[] {
    const own = this.#runs.read(segment, model);
    const href = this.#url(segment);
    const resets = [...main.properties.keys()].flatMap((property): XmlAttribute[] => {
      const reset = SPAN_RESETS[property];

      return own.properties.has(property) || reset === undefined ? [] : [[property, reset]];
    });
    const attributes: XmlAttribute[] = [
      ...(own.textStyle === main.textStyle || own.textStyle === undefined
        ? []
        : [[TEXT_CONTENT.textStyle, own.textStyle] as const]),
      ...(href === undefined || href === this.#url(base) ? [] : [[TEXT_CONTENT.href, href] as const]),
      ...[...own.properties].filter(([property, value]) => main.properties.get(property) !== value),
      ...resets,
    ];

    return attributes.length === 0
      ? this.#pieces(segment.characters)
      : [{ kind: XML_CONTENT.span, attributes, value: segment.characters }];
  }

  #url({ hyperlink }: TextSegment): string | undefined {
    return hyperlink?.type === TEXT_CONTENT.urlLink ? hyperlink.value : undefined;
  }

  /** Characters as content: nothing for none, as XML reads an empty text back as nothing. */
  #pieces(characters: string): XmlContent[] {
    return characters === "" ? [] : [{ kind: XML_CONTENT.text, value: characters }];
  }
}

export const TEXT_CONTENT_READER = new InjectionToken<TextContent>("TextContent");
