import { WriteError } from "./write-error.ts";

type NodeOfType<T extends SceneNode["type"]> = Extract<SceneNode, { readonly type: T }>;

const FRAMES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SLOT"] as const;
const SHAPES = ["RECTANGLE", "ELLIPSE", "LINE", "POLYGON", "STAR", "VECTOR"] as const;
const SIZED = [
  ...FRAMES,
  ...SHAPES,
  "GROUP",
  "TEXT",
  "BOOLEAN_OPERATION",
  "TEXT_PATH",
  "TRANSFORM_GROUP",
  "SLICE",
] as const;
const BLENDED = SIZED.filter((type) => type !== "SLICE") as Exclude<(typeof SIZED)[number], "SLICE">[];
const FILLED = [...FRAMES, ...SHAPES, "SECTION", "TEXT", "BOOLEAN_OPERATION", "TEXT_PATH"] as const;

/** A guard of the nodes of these types, by `node.type`, as Figma's typings give each type its members. */
function guard<T extends SceneNode["type"]>(types: readonly T[]): (node: SceneNode) => node is NodeOfType<T> {
  const known: ReadonlySet<string> = new Set(types);

  return (node): node is NodeOfType<T> => known.has(node.type);
}

/** Frames and what is built like one: auto layout, a grid, padding, clipping. */
export const hasAutoLayout = guard(FRAMES);
export type FrameLikeNode = NodeOfType<(typeof FRAMES)[number]>;
/** Layers with a size of their own, which auto layout and constraints place (not a section). */
export const isSized = guard(SIZED);
export type SizedNode = NodeOfType<(typeof SIZED)[number]>;
/** Layers with constraints in a parent without auto layout. */
export const hasConstraints = guard([...FRAMES, ...SHAPES, "TEXT", "TEXT_PATH"]);
/** Layers with opacity and effects. */
export const isBlended = guard(BLENDED);
/** Layers with a corner radius. */
export const hasCorners = guard([
  ...FRAMES,
  "SECTION",
  "RECTANGLE",
  "ELLIPSE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "BOOLEAN_OPERATION",
]);
/** Layers with a radius per corner. */
export const hasCornerSides = guard([...FRAMES, "SECTION", "RECTANGLE"]);
/** Layers with fills and strokes. */
export const isFilled = guard(FILLED);
export type FilledNode = NodeOfType<(typeof FILLED)[number]>;
/** Layers with a stroke weight per side. */
export const hasStrokeSides = guard([...FRAMES, "RECTANGLE"]);
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
export function refusal(node: SceneNode, what: string, hint?: string): WriteError {
  return new WriteError(`A ${node.type.toLowerCase().replaceAll("_", " ")} has no ${what}.`, hint);
}
