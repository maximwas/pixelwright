import { APPLY_PROPERTY_TYPE } from "@/shared/ops/apply/apply.constants.ts";
/** The tags this release makes a layer for, and the type each is made as (T-123); groups and vectors are not drawn. */
export const NEW_LAYER_TYPE: Readonly<Record<string, NodeType>> = {
  Frame: "FRAME",
  Section: "SECTION",
  Text: "TEXT",
  TextPath: "TEXT_PATH",
  Rectangle: "RECTANGLE",
  Ellipse: "ELLIPSE",
  Line: "LINE",
  Component: "COMPONENT",
  ComponentSet: "COMPONENT_SET",
  Instance: "INSTANCE",
  Slot: "SLOT",
  Page: "PAGE",
  Image: "RECTANGLE",
  Icon: "FRAME",
};

/** The tag whose width and height scale its drawing whole (T-134). */
export const ICON_TAG = "Icon";

/** The tags of the text layers' types, as design_read writes them: the types a tag mismatch is about. */
export const TEXT_TAG = { TEXT: "Text", TEXT_PATH: "TextPath" } as const;

/** Why 100 and 40: the room 0.7.0 left between the page's layers and a new one beside them, and around a set's variants. */
export const APPLY_PLACE = { pageGap: 100, setGap: 40 } as const;

/**
 * Figma's words when a file's plan has no page left (FX-054): "The Starter plan only comes with 3 pages"; and how a
 * layer's id inside an instance starts, I<instance>;, the rest of it the same in every instance of the component.
 */
export const APPLY_PATTERN = { pageLimit: /comes with (\d+) pages?/i, instanceLayer: /^I[^;]+;/ } as const;

/** What each name of a layer's property mark binds (T-129): prop its characters, visibleProp its visibility, swapProp its component. */
export const PROPERTY_KINDS = [
  { key: "text", field: "characters", type: APPLY_PROPERTY_TYPE.text },
  { key: "visible", field: "visible", type: APPLY_PROPERTY_TYPE.boolean },
  { key: "swap", field: "mainComponent", type: APPLY_PROPERTY_TYPE.swap },
] as const;

/** The attributes that place a layer beside another: a refused move names the one that placed it (P-143). */
export const MOVE_ATTRIBUTE = { before: "before", after: "after" } as const;

/** The layer fields a property mark drives, by name. */
export const PROPERTY_FIELD = { characters: "characters", visible: "visible" } as const;

/** Figma's values a new layer starts with. */
export const NEW_LAYER_VALUE = { hug: "HUG", none: "NONE", fit: "WIDTH_AND_HEIGHT", slot: "SLOT" } as const;

/** The kinds of style and variable a token index tells apart, as Figma names them. */
export const TOKEN_KIND = { paint: "PAINT", effect: "EFFECT", text: "TEXT", colour: "COLOR", number: "FLOAT" } as const;

export const TOKEN_TEXT = {
  keyJoint: " ",
  key: (kind: string, token: string) => `${kind} ${token}`,
  unknown: (what: string, token: string) => `No ${what} is named ${token} in this file or the libraries it uses.`,
  colourWhat: "paint style or colour variable",
  variableWhat: "variable",
  near: (near: string) => `Did you mean ${near}? Else write the value.`,
  list: "tokens_read lists the tokens the file has: bind one of them, or write the value.",
  unreachable: (token: string) => `${token} names a variable Figma cannot reach now.`,
  unreachableHint: "Enable its library, or use a value.",
  wrongType: (
    token: string,
    held: string,
    wanted: string,
  ) =>
    `${token} is a ${held.toLowerCase()} variable: this needs a ${wanted.toLowerCase()} one.`,
} as const;

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
  copyNotMade: "The copy it is in was not made: fix that element's error first.",
  instanceNotMade: "The instance it is in was not made: fix that element's error first.",
  noInstanceLayer: (id: string | undefined) => `The new instance has no layer for ${id}.`,
  instanceLayerHint:
    "Inside a new instance, name its layers by another instance's ids of the same component and variant, or by the component's own.",
  propOnText: "prop makes a text property: it goes on a <Text>.",
  propHint: "Use visibleProp on other layers.",
  swapOnInstance: "swapProp makes an instance swap property: it goes on an <Instance>.",
  markInInstance: "This layer is inside an instance: prop, visibleProp and swapProp bind a component's own layers.",
  markInInstanceHint: "Give them on the main component's layer, by its id.",
  noComponent:
    "No component holds this layer: prop, visibleProp and swapProp bind a component's layers to its properties.",
  otherKind: (
    owner: string,
    kind: string,
    name: string,
  ) =>
    `${owner} has a ${kind} property ${name}: another kind cannot take its name.`,
  otherKindHint: "Name the property otherwise.",
  swapGone: (name: string) => `${name}'s component is gone: it cannot be the swap property's default.`,
  noCounterpart: (id: string | undefined) => `The copy has no layer for ${id}.`,
  counterpartHint: "Inside a copy, name only layers of the copied one, where they are in it.",
  inInstance: "A layer inside an instance comes from its component and stays where it is.",
  onlySlots: "Layers go into an instance only through its slots.",
  intoItself: "A layer cannot go inside itself.",
  noNeighbour: (id: string) => `No layer ${id} to put the new one next to.`,
  notBeside: (id: string) => `${id} is not in this element's parent: before and after name a layer beside it.`,
  thePage: "the page",
  pageLimit: (limit: string, name: string) =>
    `The file's Figma plan allows ${limit} pages: ${name} is not made, and the layers in it are not created.`,
  pageLimitHint: 'Put them on a page the file has: <Page id="…"> with a page id from file_map, or the parent input.',
  noPage: (id: string | null) => `No page ${id} in this file.`,
  notPage: (id: string | null, type: string) => `${id} is ${withArticle(type)}, not a page.`,
  pageHint: "file_map lists the file's pages with their ids.",
  notYet: (attribute: string) => `${attribute} is not written to Figma in this release.`,
  slot: "A slot is made in a component.",
  slotHint: 'In an instance, fill the slot it has: give its <Slot id="…"> new layers.',
  emptySet: "A ComponentSet is made of the Components inside it: give it one at least.",
  notReached: (src: string) => `${src} did not reach the plugin.`,
  notReachedHint: "Send it again, or fewer files in one call.",
  keptHeld: (error: unknown) =>
    `It stays in the file: a layer that was there before the call is inside it and could not be put back where it was (${error instanceof Error ? error.message : String(error)}).`,
  keptHeldHint: "Put that layer back by hand, then delete this one.",

  setHoldsComponents: (tag: string) => `A ComponentSet holds only Components: <${tag}> is not one.`,
  setHoldsComponentsHint: "Move it out of the set, or make it a Component.",
} as const;
