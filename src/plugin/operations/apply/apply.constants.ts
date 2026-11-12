/** The tags this release makes a layer for, and the type each is made as (T-123); groups and vectors are not drawn. */
export const NEW_LAYER_TYPE: Readonly<Record<string, NodeType>> = {
  Frame: "FRAME",
  Section: "SECTION",
  Text: "TEXT",
  Rectangle: "RECTANGLE",
  Ellipse: "ELLIPSE",
  Line: "LINE",
  Component: "COMPONENT",
  ComponentSet: "COMPONENT_SET",
  Slot: "SLOT",
};

/** The tags of the text layers' types, as design_read writes them: the types a tag mismatch is about. */
export const TEXT_TAG = { TEXT: "Text", TEXT_PATH: "TextPath" } as const;

/** Why 100: the room 0.7.0 left between the page's layers and a new one placed beside them. */
export const APPLY_PLACE = { pageGap: 100 } as const;

/** Figma's values a new layer starts with. */
export const NEW_LAYER_VALUE = { hug: "HUG", none: "NONE", fit: "WIDTH_AND_HEIGHT", slot: "SLOT" } as const;

function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

export const APPLY_TEXT = {
  noLayer: (id: string | null) => `No layer ${id} in this file.`,
  noLayerHint: "Read the ids again with design_read or nodes_find.",
  notTag: (
    id: string | null,
    type: string,
    tag: string,
  ) => `${id} is ${withArticle(type)}, not ${withArticle(tag)}.`,
  tagHint: "Check the id: the tag is the layer's type as design_read writes it.",
  noParent: "Its parent element was not written: fix the parent's error first.",
  parentFailed: (tag: string, line: number) =>
    `Its parent <${tag}> on line ${line} was not created: fix that error first.`,
  holdsNoLayers: (type: string) => `A ${type} holds no layers: put the new one in a frame.`,
  cannotMake: (tag: string) => `Creating a ${tag} is not written to Figma in this release.`,
  copies: "Copies and the layers inside a copy or a new instance are not written to Figma in this release.",
  notYet: (attribute: string) => `${attribute} is not written to Figma in this release.`,
  span: "Span",
  slot: "A slot is made in a component.",
  slotHint: 'In an instance, fill the slot it has: give its <Slot id="…"> new layers.',
  emptySet: "A ComponentSet is made of the Components inside it: give it one at least.",
} as const;
