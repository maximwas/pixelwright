/**
 * The instance properties an element lists: the variant's values in `variant`; the instance's own texts and toggles in
 * `props` (a swapped instance and a slot show as children).
 */
export const PROPERTY_TYPES = { variant: { VARIANT: "VARIANT" }, own: { TEXT: "TEXT", BOOLEAN: "BOOLEAN" } } as const;

/** The fields a component's layer binds to its properties (componentPropertyReferences): text, visibility, swap. */
export const PROPERTY_FIELD = { characters: "characters", visible: "visible", mainComponent: "mainComponent" } as const;

/** Figma suffixes a non-variant property's name with its id ("Label#12:0"); people read the bare name. */
export const PROPERTY_NAME = { idSuffix: /#[^#]*$/ } as const;

/**
 * What an instance's overridden Figma field is called in `$override` (C-133). A field Figma adds later passes through
 * as Figma names it. Figma's own misspelt `stokeTopWeight` maps like its siblings.
 */
export const OVERRIDE_WORDS: Readonly<Record<string, string>> = {
  characters: "text",
  fills: "background",
  fillStyleId: "background",
  backgrounds: "background",
  backgroundStyleId: "background",
  strokeStyleId: "border",
  effectStyleId: "box-shadow",
  minWidth: "size",
  maxWidth: "size",
  minHeight: "size",
  maxHeight: "size",
  strokes: "border",
  strokeWeight: "border",
  strokeTopWeight: "border",
  stokeTopWeight: "border",
  strokeRightWeight: "border",
  strokeBottomWeight: "border",
  strokeLeftWeight: "border",
  strokeAlign: "border",
  dashPattern: "border",
  effects: "box-shadow",
  cornerRadius: "border-radius",
  topLeftRadius: "border-radius",
  topRightRadius: "border-radius",
  bottomLeftRadius: "border-radius",
  bottomRightRadius: "border-radius",
  opacity: "opacity",
  visible: "visibility",
  fontName: "font",
  fontSize: "font",
  fontWeight: "font",
  lineHeight: "font",
  letterSpacing: "font",
  textCase: "font",
  textDecoration: "font",
  textStyleId: "font",
  paddingLeft: "padding",
  paddingRight: "padding",
  paddingTop: "padding",
  paddingBottom: "padding",
  itemSpacing: "gap",
  counterAxisSpacing: "gap",
  layoutMode: "layout",
  primaryAxisAlignItems: "layout",
  counterAxisAlignItems: "layout",
  layoutWrap: "layout",
};

/** A text layer's fills are its text colour. */
export const TEXT_OVERRIDE_WORDS: Readonly<Record<string, string>> = { fills: "color", fillStyleId: "color" };

/**
 * Overridden fields that say nothing to the code: the layer's name, the sizes and places its layout gives it, notes,
 * prototype links, the runs that come with new text, the instance's own properties (written as `props`), and what
 * does not show: a lock, the layers panel's state, plugin data, export settings, a description.
 */
export const OVERRIDE_NOISE = {
  name: true,
  x: true,
  y: true,
  width: true,
  height: true,
  relativeTransform: true,
  constraints: true,
  layoutSizingHorizontal: true,
  layoutSizingVertical: true,
  primaryAxisSizingMode: true,
  counterAxisSizingMode: true,
  layoutAlign: true,
  layoutGrow: true,
  annotations: true,
  reactions: true,
  styledTextSegments: true,
  componentProperties: true,
  pluginData: true,
  sharedPluginData: true,
  locked: true,
  expanded: true,
  autoRename: true,
  exportSettings: true,
  description: true,
} as const;

/** The order `$override` lists its words in; a word not here follows them, in the order Figma gave it. */
export const OVERRIDE_ORDER: readonly string[] = [
  "text",
  "background",
  "color",
  "border",
  "box-shadow",
  "border-radius",
  "opacity",
  "visibility",
  "font",
  "size",
  "padding",
  "gap",
  "layout",
];

export const OVERRIDE = { separator: ", " } as const;

/**
 * A variable mode as the attribute tokens_read's CSS selects on (C-135): `data-<collection slug>="<mode slug>"`, a slug
 * lower case with letters and digits of any script, the rest as "-"; a name with none is "mode".
 */
export const MODE_ATTRIBUTE = {
  name: (slug: string) => `data-${slug}`,
  other: /[^\p{L}\p{N}]+/gu,
  edges: /^-+|-+$/g,
  dash: "-",
  empty: "mode",
} as const;
