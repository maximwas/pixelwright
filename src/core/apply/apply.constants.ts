import { CSS_ORDER, CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { TAG } from "@/core/xml/tags.constants.ts";

/** What a change does to its layer. */
export const CHANGE_KIND = { create: "create", update: "update" } as const;

/** Tags of design_apply that Figma's node types do not name. */
export const APPLY_TAG = { span: "Span", image: "Image", icon: "Icon", root: "root" } as const;

/** Tags design_apply can create: a Page only at the top level, empty but for the layers the XML puts in it. */
export const CREATABLE_TAGS: ReadonlySet<string> = new Set([
  TAG.PAGE,
  TAG.FRAME,
  TAG.SECTION,
  TAG.TEXT,
  TAG.TEXT_PATH,
  TAG.RECTANGLE,
  TAG.ELLIPSE,
  TAG.LINE,
  TAG.INSTANCE,
  TAG.COMPONENT,
  TAG.COMPONENT_SET,
  APPLY_TAG.image,
  APPLY_TAG.icon,
  TAG.SLOT,
]);

/** Tags whose layers can be changed by id but not created: vectors come as an Icon from an SVG, groups by grouping. */
export const UNDRAWN_TAGS: ReadonlySet<string> = new Set([
  TAG.GROUP,
  TAG.VECTOR,
  TAG.STAR,
  TAG.POLYGON,
  TAG.BOOLEAN_OPERATION,
  TAG.TRANSFORM_GROUP,
]);

/** Every tag design_read writes: the ones above and every other Figma layer type, changed by id, never created. */
export const KNOWN_TAGS: ReadonlySet<string> = new Set([
  ...CREATABLE_TAGS,
  ...UNDRAWN_TAGS,
  APPLY_TAG.span,
  TAG.TABLE,
  TAG.TABLE_CELL,
  TAG.MEDIA,
  TAG.EMBED,
  TAG.LINK_UNFURL,
  TAG.SLICE,
  TAG.WIDGET,
  TAG.STICKY,
  TAG.CONNECTOR,
  TAG.SHAPE_WITH_TEXT,
  TAG.CODE_BLOCK,
  TAG.STAMP,
  TAG.HIGHLIGHT,
  TAG.WASHI_TAPE,
  TAG.SLIDE,
  TAG.SLIDE_ROW,
  TAG.SLIDE_GRID,
  TAG.INTERACTIVE_SLIDE_ELEMENT,
]);

/** Shapes and assets: they clip nothing and hold no layout. */
export const SHAPE_TAGS: ReadonlySet<string> = new Set([
  TAG.RECTANGLE,
  TAG.ELLIPSE,
  TAG.LINE,
  TAG.VECTOR,
  TAG.STAR,
  TAG.POLYGON,
  TAG.BOOLEAN_OPERATION,
  APPLY_TAG.image,
  APPLY_TAG.icon,
  TAG.TEXT_PATH,
]);

/** Tags whose layers hold text: a Text, and a TextPath, whose text is written as a Text's. */
export const TEXT_TAGS: ReadonlySet<string> = new Set([TAG.TEXT, TAG.TEXT_PATH]);

/** Tags whose layers can hold a layout of their own. */
export const LAYOUT_TAGS: ReadonlySet<string> = new Set([
  TAG.FRAME,
  TAG.COMPONENT,
  TAG.COMPONENT_SET,
  TAG.INSTANCE,
  TAG.SLOT,
]);

/** Metadata attributes the XML carries besides CSS. */
export const ATTRIBUTE = {
  id: "id",
  name: "name",
  component: "component",
  variant: "variant",
  props: "props",
  description: "description",
  note: "note",
  href: "href",
  textStyle: "textStyle",
  mask: "mask",
  src: "src",
  before: "before",
  after: "after",
  copyOf: "copyOf",
  prop: "prop",
  visibleProp: "visibleProp",
  swapProp: "swapProp",
  d: "d",
  arc: "arc",
  start: "start",
  truncated: "$truncated",
} as const;

/** What a TextPath has besides its text: its path, the arc that draws one, and where on it the text starts. */
export const PATH_ATTRIBUTES: ReadonlySet<string> = new Set([ATTRIBUTE.d, ATTRIBUTE.arc, ATTRIBUTE.start]);

/** The attributes that make a component property of a layer. */
export const PROPERTY_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTRIBUTE.prop,
  ATTRIBUTE.visibleProp,
  ATTRIBUTE.swapProp,
]);

/** Metadata attributes: what the layer is, not how it looks. */
export const META_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTRIBUTE.id,
  ATTRIBUTE.name,
  ATTRIBUTE.component,
  ATTRIBUTE.variant,
  ATTRIBUTE.props,
  ATTRIBUTE.description,
  ATTRIBUTE.note,
  ATTRIBUTE.href,
  ATTRIBUTE.textStyle,
  ATTRIBUTE.mask,
  ATTRIBUTE.src,
  ATTRIBUTE.before,
  ATTRIBUTE.after,
  ATTRIBUTE.copyOf,
  ...PROPERTY_ATTRIBUTES,
  ...PATH_ATTRIBUTES,
]);

/** The CSS attributes the mapping reads and writes. */
export const CSS_ATTRIBUTES: ReadonlySet<string> = new Set(CSS_ORDER);

/** What a run of text (`<Span>`) may set. */
export const SPAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTRIBUTE.textStyle,
  ATTRIBUTE.href,
  CSS_PROPERTY.font,
  CSS_PROPERTY.letterSpacing,
  CSS_PROPERTY.textTransform,
  CSS_PROPERTY.textDecoration,
  CSS_PROPERTY.textUnderlineOffset,
  CSS_PROPERTY.textDecorationThickness,
  CSS_PROPERTY.color,
]);

/** A frame's own layout, auto layout or grid (display is checked by its value). */
export const LAYOUT_ATTRIBUTES: ReadonlySet<string> = new Set([
  CSS_PROPERTY.flexDirection,
  CSS_PROPERTY.flexWrap,
  CSS_PROPERTY.gap,
  CSS_PROPERTY.rowGap,
  CSS_PROPERTY.columnGap,
  CSS_PROPERTY.padding,
  CSS_PROPERTY.paddingTop,
  CSS_PROPERTY.paddingRight,
  CSS_PROPERTY.paddingBottom,
  CSS_PROPERTY.paddingLeft,
  CSS_PROPERTY.justifyContent,
  CSS_PROPERTY.alignItems,
  CSS_PROPERTY.alignContent,
  CSS_PROPERTY.gridTemplateColumns,
  CSS_PROPERTY.gridTemplateRows,
]);

/** What only a Text takes (its spans the run ones). */
export const TEXT_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTRIBUTE.textStyle,
  CSS_PROPERTY.font,
  CSS_PROPERTY.letterSpacing,
  CSS_PROPERTY.textTransform,
  CSS_PROPERTY.textDecoration,
  CSS_PROPERTY.textUnderlineOffset,
  CSS_PROPERTY.textDecorationThickness,
  CSS_PROPERTY.textAlign,
  CSS_PROPERTY.textWrap,
  CSS_PROPERTY.color,
  CSS_PROPERTY.textOverflow,
  CSS_PROPERTY.whiteSpace,
]);

/** A box's own paint, which a Text, a Line and a Group do not have. */
export const BOX_PAINT: ReadonlySet<string> = new Set([
  CSS_PROPERTY.background,
  CSS_PROPERTY.border,
  CSS_PROPERTY.borderTop,
  CSS_PROPERTY.borderRight,
  CSS_PROPERTY.borderBottom,
  CSS_PROPERTY.borderLeft,
  CSS_PROPERTY.outline,
  CSS_PROPERTY.borderRadius,
  CSS_PROPERTY.boxShadow,
]);

/** What a value, a name or an id looks like. */
export const APPLY_PATTERN = {
  /** A Figma layer id: 54:243, or an instance's layer I54:268;54:211 (C-167). */
  layerId: /^I?\d+:\d+(?:;\d+:\d+)*$/,
  /** A variable collection's mode as an attribute: `data-` and a slug (C-135). */
  mode: /^data-[\p{L}\p{N}][\p{L}\p{N}-]*$/u,
  /** A bare number, as a habit attribute writes one. */
  number: /^-?\d*\.?\d+$/,
  readOnlyPrefix: "$",
} as const;

/** Each known tag by its lowercase spelling: HTML's `<span>` is the Span tag. */
export const TAG_BY_LOWERCASE: ReadonlyMap<string, string> = new Map(
  [...KNOWN_TAGS].map((tag) => [tag.toLowerCase(), tag]),
);

/** What `display` may say on a tag with no layout. */
export const DISPLAY_VALUES: ReadonlySet<string> = new Set(["none", "block"]);
