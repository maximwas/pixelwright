import { MIXED } from "@pixelwright/core";
import { plain } from "../../../utils/plain.ts";
import { BASE_SEGMENT_FIELDS, SEGMENT_FIELDS } from "../constants.ts";
import type { LayerEntry } from "../layer-entry.ts";

/**
 * A text's characters, how it sizes and aligns, its runs with their styles, and its paragraph settings; a text on a
 * path's text as a text's, with the path it runs along and where on it the text starts.
 */
export function readText(entry: LayerEntry): void {
  const { node } = entry;

  if (node.type === "TEXT") {
    entry.set("text", textOf(node));
  } else if (node.type === "TEXT_PATH") {
    entry.set("text", {
      characters: node.characters,
      // A text on a path never sizes itself to its text: its path holds it.
      textAutoResize: "NONE",
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical,
      segments: plain(segmentsOf(node)),
    });
    entry.set("textPath", {
      vectorPaths: plain(node.vectorPaths),
      textPathStartData: plain(node.textPathStartData),
    });
  }
}

function textOf(node: TextNode): Record<string, unknown> {
  const text: Record<string, unknown> = {
    characters: node.characters,
    textAutoResize: node.textAutoResize,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    segments: plain(segmentsOf(node)),
  };

  if (node.textTruncation !== "DISABLED") {
    text.textTruncation = node.textTruncation;
    text.maxLines = node.maxLines;
  }

  if (node.leadingTrim !== "NONE" && typeof node.leadingTrim === "string") {
    text.leadingTrim = node.leadingTrim;
  }

  if (node.hangingPunctuation) {
    text.hangingPunctuation = true;
  }

  if (node.paragraphSpacing !== 0) {
    text.paragraphSpacing = node.paragraphSpacing === figma.mixed ? MIXED : node.paragraphSpacing;
  }

  if (typeof node.listSpacing === "number" && node.listSpacing > 0) {
    text.listSpacing = node.listSpacing;
  }

  return text;
}

function segmentsOf(node: TextNode | TextPathNode) {
  try {
    return node.getStyledTextSegments(SEGMENT_FIELDS);
  } catch {
    return node.getStyledTextSegments(BASE_SEGMENT_FIELDS);
  }
}
