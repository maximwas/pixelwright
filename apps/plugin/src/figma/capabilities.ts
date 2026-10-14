import { WriteError } from "./write-error.ts";

type NodeOfType<T extends SceneNode["type"]> = Extract<SceneNode, { readonly type: T }>;

const FRAMES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SLOT"] as const;
const SHAPES = ["RECTANGLE", "ELLIPSE", "LINE", "POLYGON", "STAR", "VECTOR"] as const;
/** FigJam's stickers: shapes with a size, fills, strokes and effects of their own (DefaultShapeMixin). */
const STICKERS = ["STAMP", "HIGHLIGHT", "WASHI_TAPE"] as const;
/** FigJam's and Slides' layers placed by x and y alone (OpaqueNodeMixin): Figma sizes them itself. */
const OPAQUE = [
  "STICKY",
  "SHAPE_WITH_TEXT",
  "CONNECTOR",
  "TABLE",
  "CODE_BLOCK",
  "WIDGET",
  "EMBED",
  "LINK_UNFURL",
  "MEDIA",
] as const;
const SIZED = [
  ...FRAMES,
  ...SHAPES,
  ...STICKERS,
  "GROUP",
  "TEXT",
  "BOOLEAN_OPERATION",
  "TEXT_PATH",
  "TRANSFORM_GROUP",
  "SLICE",
] as const;
const BLENDED = SIZED.filter((type) => type !== "SLICE") as Exclude<(typeof SIZED)[number], "SLICE">[];
const PAINTED = [
  ...FRAMES,
  ...SHAPES,
  ...STICKERS,
  "SECTION",
  "TEXT",
  "BOOLEAN_OPERATION",
  "TEXT_PATH",
  "SLIDE",
] as const;
/** A layer with fills: the design layers, and FigJam's sticky, shape and table (MinimalFillsMixin). */
const FILLED = [...PAINTED, "STICKY", "SHAPE_WITH_TEXT", "TABLE"] as const;
/** A layer with strokes: the design layers, and FigJam's shape and connector (MinimalStrokesMixin). */
const STROKED = [...PAINTED, "SHAPE_WITH_TEXT", "CONNECTOR"] as const;

/** A layer as far as a guard reads it: its type alone, so a dry run can ask of a layer it has not made. */
export type TypedLayer = Pick<SceneNode, "type">;

/** A guard of the nodes of these types, by `node.type`, as Figma's typings give each type its members. */
function guard<T extends SceneNode["type"]>(types: readonly T[]): (node: TypedLayer) => node is NodeOfType<T> {
  const known: ReadonlySet<string> = new Set(types);

  return (node): node is NodeOfType<T> => known.has(node.type);
}

/** Frames and what is built like one: auto layout, a grid, padding, clipping. */
export const hasAutoLayout = guard(FRAMES);
export type FrameLikeNode = NodeOfType<(typeof FRAMES)[number]>;
/** Layers with a size of their own, which auto layout and constraints place (not a section). */
export const isSized = guard(SIZED);
export type SizedNode = NodeOfType<(typeof SIZED)[number]>;
/** Layers placed by a matrix of their own: those with a size, a section, and the ones Figma sizes itself. */
export const isPlaced = guard([...SIZED, "SECTION", ...OPAQUE]);
export type PlacedNode = NodeOfType<(typeof SIZED)[number] | "SECTION" | (typeof OPAQUE)[number]>;
/** Layers with constraints in a parent without auto layout. */
export const hasConstraints = guard([...FRAMES, ...SHAPES, "TEXT", "TEXT_PATH", "STAMP", "HIGHLIGHT"]);
/** Layers with an opacity (MinimalBlendMixin): FigJam's notes, shapes, connectors, tables and code blocks too. */
export const hasOpacity = guard([...BLENDED, "SLIDE", "STICKY", "SHAPE_WITH_TEXT", "CONNECTOR", "TABLE", "CODE_BLOCK"]);
/** Layers with effects (BlendMixin). */
export const hasEffects = guard([...BLENDED, "SLIDE"]);
/** Layers with a corner radius. */
export const hasCorners = guard([
  ...FRAMES,
  "SECTION",
  "SLIDE",
  "RECTANGLE",
  "ELLIPSE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "BOOLEAN_OPERATION",
  "HIGHLIGHT",
]);
/** Layers with a radius per corner. */
export const hasCornerSides = guard([...FRAMES, "SECTION", "SLIDE", "RECTANGLE"]);
/** Layers with fills. */
export const hasFills = guard(FILLED);
export type FillsNode = NodeOfType<(typeof FILLED)[number]>;
/** Layers with strokes. */
export const hasStrokes = guard(STROKED);
export type StrokesNode = NodeOfType<(typeof STROKED)[number]>;
/** Layers with a stroke weight per side. */
export const hasStrokeSides = guard([...FRAMES, "SLIDE", "RECTANGLE"]);
/** Layers with Dev Mode annotations. */
export const isAnnotated = guard([
  ...FRAMES,
  "RECTANGLE",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "TEXT",
  "TEXT_PATH",
]);
/** Layers that hold children. */
export const hasChildren = guard([...FRAMES, "GROUP", "SECTION", "BOOLEAN_OPERATION", "TRANSFORM_GROUP"]);

/** Why a layer of this type cannot take what an attribute writes. */
export function refusal(node: TypedLayer, what: string, hint?: string): WriteError {
  return new WriteError(`A ${node.type.toLowerCase().replaceAll("_", " ")} has no ${what}.`, hint);
}
