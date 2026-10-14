import { MIXED } from "@pixelwright/core";
import { plain } from "../../../utils/plain.ts";
import { BASE_SEGMENT_FIELDS, SEGMENT_FIELDS } from "../constants.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** A text's characters, how it sizes and aligns, its runs with their styles, and its paragraph settings. */
export function readText(entry: LayerEntry): void {
  if (entry.node.type === "TEXT") {
    entry.set("text", textOf(entry.node));
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

function segmentsOf(node: TextNode) {
  try {
    return node.getStyledTextSegments(SEGMENT_FIELDS);
  } catch {
    return node.getStyledTextSegments(BASE_SEGMENT_FIELDS);
  }
}
