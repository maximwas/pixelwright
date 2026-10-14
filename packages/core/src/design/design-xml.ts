import type { DesignRead, DesignXmlOptions } from "../types/design.ts";
import type { Snapshot } from "../types/snapshot.ts";
import { DesignBuilder } from "./builder/design-builder.ts";
import { type SerializedDesign, serializeDesign } from "./serializer.ts";
import type { DesignTree } from "./tree.ts";

/** The design tree of a snapshot: what design_read reads, before it is written as XML. */
export function designTree(snapshot: Snapshot, options: DesignXmlOptions = {}): DesignTree {
  return new DesignBuilder(snapshot, options).build();
}

/**
 * A snapshot as Pixelwright's XML: Figma's layer types as tags (Image and Icon for true assets), metadata, and the
 * CSS of the one mapping table; with the tokens, text styles and fonts it refers to and the assets it plans.
 */
export function designXml(snapshot: Snapshot, options: DesignXmlOptions = {}): DesignRead {
  return renderDesign(snapshot, options).read;
}

/** The read with the lines it is made of and where each layer sits in them (fitting measures branches with it). */
export function renderDesign(
  snapshot: Snapshot,
  options: DesignXmlOptions = {},
): { read: DesignRead; lines: SerializedDesign["lines"]; spans: SerializedDesign["spans"] } {
  const { root, ...refers } = designTree(snapshot, options);
  const { xml, lines, spans } = serializeDesign(root);

  return {
    read: {
      xml,
      ...refers,
    },
    lines,
    spans,
  };
}
