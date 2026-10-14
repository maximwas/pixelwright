/**
 * What an instance's overridden Figma field is called in `$override`. A field Figma adds later passes through as Figma
 * names it. Figma's own misspelt `stokeTopWeight` maps like its siblings.
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
export const TEXT_OVERRIDE_WORDS: Readonly<Record<string, string>> = {
  fills: "color",
  fillStyleId: "color",
};

/**
 * Overridden fields that say nothing to the code: the layer's name, the sizes and places its layout gives it, notes,
 * prototype links, the runs that come with new text, the instance's own properties (written as `props`), and what
 * does not show: a lock, the layers panel's state, plugin data, export settings, a description.
 */
export const OVERRIDE_NOISE: ReadonlySet<string> = new Set([
  "name",
  "x",
  "y",
  "width",
  "height",
  "relativeTransform",
  "constraints",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "layoutAlign",
  "layoutGrow",
  "annotations",
  "reactions",
  "styledTextSegments",
  "componentProperties",
  "pluginData",
  "sharedPluginData",
  "locked",
  "expanded",
  "autoRename",
  "exportSettings",
  "description",
]);

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
