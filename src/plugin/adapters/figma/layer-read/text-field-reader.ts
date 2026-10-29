import { injectable } from "@needle-di/core";
import { TEXT_FIELD } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

type Text = NonNullable<ReadLayer["text"]>;

/**
 * A text's characters, how it sizes and aligns, its runs with their styles and its paragraph settings (0.7.0's text
 * reader); a text on a path's text as a text's, with the path it runs along and where on it the text starts. The
 * server maps them to CSS and Spans.
 */
@injectable()
export class TextFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    if (node.type === TEXT_FIELD.text) {
      return { text: this.#text(node) };
    }

    if (node.type !== TEXT_FIELD.textPath) {
      return {};
    }

    return {
      text: {
        characters: node.characters,
        textAutoResize: TEXT_FIELD.pathResize,
        textAlignHorizontal: node.textAlignHorizontal,
        textAlignVertical: node.textAlignVertical,
        segments: this.#segments(node),
      },
      textPath: { vectorPaths: this.#plain(node.vectorPaths), textPathStartData: this.#plain(node.textPathStartData) },
    };
  }

  #text(node: TextNode): Text {
    const { paragraphSpacing, listSpacing, leadingTrim } = node;

    return {
      characters: node.characters,
      textAutoResize: node.textAutoResize,
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical,
      segments: this.#segments(node),
      ...(node.textTruncation === TEXT_FIELD.noTruncation
        ? {}
        : { textTruncation: node.textTruncation, maxLines: node.maxLines }),
      ...(typeof leadingTrim === "string" && leadingTrim !== TEXT_FIELD.noTrim ? { leadingTrim } : {}),
      ...(node.hangingPunctuation ? { hangingPunctuation: node.hangingPunctuation } : {}),
      ...(paragraphSpacing === 0
        ? {}
        : { paragraphSpacing: typeof paragraphSpacing === "number" ? paragraphSpacing : READ_VALUE.mixed }),
      ...(typeof listSpacing === "number" && listSpacing > 0 ? { listSpacing } : {}),
    };
  }

  /** FX-012: the newer run fields first; a Figma that lacks one refuses the call, so then the base fields. */
  #segments(node: TextNode | TextPathNode): Text["segments"] {
    try {
      return this.#plain(node.getStyledTextSegments([...TEXT_FIELD.segmentFields]));
    } catch {
      return this.#plain(node.getStyledTextSegments([...TEXT_FIELD.baseSegmentFields]));
    }
  }

  /** Plugin API values are frozen objects with readonly arrays: a JSON copy is what goes on the wire anyway. */
  #plain<Value>(value: unknown): Value {
    return JSON.parse(JSON.stringify(value));
  }
}
