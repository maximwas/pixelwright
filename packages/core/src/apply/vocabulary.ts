/** Tags design_apply can create. */
export const CREATABLE_TAGS: ReadonlySet<string> = new Set([
  "Frame",
  "Section",
  "Text",
  "Rectangle",
  "Ellipse",
  "Line",
  "Instance",
  "Component",
  "ComponentSet",
  "Image",
  "Icon",
  "Slot",
]);

/** Tags whose layers can be changed by id but not created: vectors come as an Icon from an SVG, groups by grouping. */
export const UNDRAWN_TAGS: ReadonlySet<string> = new Set([
  "Group",
  "Vector",
  "Star",
  "Polygon",
  "BooleanOperation",
  "TextPath",
  "TransformGroup",
]);

/**
 * Every tag design_read writes: the ones above and every other Figma layer type (FigJam's, Slides', widgets), changed
 * by id, never created.
 */
export const KNOWN_TAGS: ReadonlySet<string> = new Set([
  ...CREATABLE_TAGS,
  ...UNDRAWN_TAGS,
  "Span",
  "Table",
  "TableCell",
  "Media",
  "Embed",
  "LinkUnfurl",
  "Slice",
  "Widget",
  "Sticky",
  "Connector",
  "ShapeWithText",
  "CodeBlock",
  "Stamp",
  "Highlight",
  "WashiTape",
  "Slide",
  "SlideRow",
  "SlideGrid",
  "InteractiveSlideElement",
]);

/** Metadata attributes: what the layer is, not how it looks. */
export const META_ATTRIBUTES: ReadonlySet<string> = new Set([
  "id",
  "name",
  "component",
  "variant",
  "props",
  "description",
  "note",
  "href",
  "textStyle",
  "mask",
  "src",
  "before",
  "after",
  "copyOf",
  "prop",
  "visibleProp",
  "swapProp",
]);

/** A Figma layer id: 54:243, or an instance's layer I54:268;54:211. */
export const LAYER_ID = /^I?\d+:\d+(?:;\d+:\d+)*$/;

/** Shapes and assets: they clip nothing and hold no layout. */
export const SHAPE_TAGS: ReadonlySet<string> = new Set([
  "Rectangle",
  "Ellipse",
  "Line",
  "Vector",
  "Star",
  "Polygon",
  "BooleanOperation",
  "Image",
  "Icon",
  "TextPath",
]);
