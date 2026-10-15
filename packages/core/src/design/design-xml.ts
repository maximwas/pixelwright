import type { Snapshot } from "../types/snapshot.ts";
import { DesignBuilder } from "./builder/design-builder.ts";
import { type SerializedDesign, serializeDesign } from "./serializer.ts";
import type { DesignTree } from "./tree.ts";
import type { DesignRead, DesignXmlOptions } from "./types.ts";

/** The design tree of a snapshot: what design_read reads, before it is written as XML. */
export function designTree(snapshot: Snapshot, options: DesignXmlOptions = {}): DesignTree {
  return new DesignBuilder(snapshot, options).build();
}

/** A design tree as design_read answers with it: the XML, and the tokens, text styles, fonts and assets it names. */
export function designReadOf({ root, ...refers }: DesignTree): DesignRead {
  return {
    xml: serializeDesign(root).xml,
    ...refers,
  };
}

/**
 * A snapshot as Pixelwright's XML: Figma's layer types as tags (Image and Icon for true assets), metadata, and the
 * CSS of the one mapping table; with the tokens, text styles and fonts it refers to and the assets it plans.
 */
export function designXml(snapshot: Snapshot, options: DesignXmlOptions = {}): DesignRead {
  return designReadOf(designTree(snapshot, options));
}

/** A read with the lines it is made of and where each layer sits in them: fitting measures branches with them. */
export interface RenderedDesign {
  readonly read: DesignRead;
  readonly lines: SerializedDesign["lines"];
  readonly spans: SerializedDesign["spans"];
}

/** The read with the lines it is made of and where each layer sits in them. */
export function renderDesign(snapshot: Snapshot, options: DesignXmlOptions = {}): RenderedDesign {
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
