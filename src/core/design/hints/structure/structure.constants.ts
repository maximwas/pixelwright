import { HINT_LABEL } from "@/core/design/hints/hints.constants.ts";

/** The Figma values the structure hints read. */
export const STRUCTURE_FIGMA = {
  frame: "FRAME",
  group: "GROUP",
  rectangle: "RECTANGLE",
  text: "TEXT",
  image: "IMAGE",
  noise: "NOISE",
  tile: "TILE",
  fixed: "FIXED",
  vertical: "VERTICAL",
  hugging: "WIDTH_AND_HEIGHT",
  gradient: "GRADIENT_",
  /** A layer inside an instance: its id starts `I`, and its component is where it is built. */
  inInstance: "I",
  lineBreak: "\n",
} as const;

/** The axes children stack along: down first, then across. */
export const STRUCTURE_AXES = [
  { start: "y", size: "height" },
  { start: "x", size: "width" },
] as const;

/** How far apart two gaps may be and still be one gap, in px: Figma's boxes carry float noise. */
export const SPACING_SLACK = 0.5;

/** How much narrower than its column a fixed width must be to be flagged, or how far a box may reach, in px. */
export const ROOM_SLACK = 1;

/** Children a stack or a structure needs before it says anything: one layer is no stack. */
export const CHILDREN_MIN = 2;

/** How many alike structures make a component worth it (rule 2 of the guide). */
export const REPEAT_MIN = 3;

/** Layers a top-level frame needs before sharing them says anything: two bare frames always look alike. */
export const STATE_LAYERS_MIN = 5;

/** The part of the larger frame's layers two top-level frames share to look like states of one component. */
export const STATE_SHARE = 0.8;

/** A layer's structure as a key: its type, its auto layout direction and its children's, in order. */
export const LAYER_SHAPE_KEY = {
  of: (
    type: string,
    layout: string,
    children: readonly string[],
  ) => `${type}${layout}(${children.join(",")})`,
} as const;

/** Each structure hint's words, frozen by the every-hint golden: change them only on purpose. */
export const STRUCTURE_TEXT = {
  absolute: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} auto layout frames place` : "An auto layout frame places"} children absolutely (${HINT_LABEL.listed(examples)}): the design shows the look, not the build; put them in the flow, with that gap where there is one.`,
  absoluteExample: (
    label: string,
    children: number,
    gap: string | null,
  ) =>
    `${label}: ${children} children are placed absolutely inside an auto layout parent${gap === null ? "" : `, likely a stack with gap ${gap}`}`,
  spacer: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} empty layers space` : "An empty layer spaces"} the flow (${HINT_LABEL.listed(examples)}): use the parent's gap or padding, not an element.`,
  spacerExample: (
    label: string,
    width: string,
    height: string,
  ) => `${label} ${width} × ${height}`,
  forcedBreak: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} texts break their lines by hand and hug them` : "A text breaks its lines by hand and hugs them"} (${HINT_LABEL.listed(examples)}): unless a break is meant, let the build wrap the text in its width.`,
  evenSpacing: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} frames without auto layout space their` : "A frame without auto layout spaces its"} children evenly (${HINT_LABEL.listed(examples)}): build them as a flow with that gap.`,
  evenSpacingExample: (label: string, gap: string) => `${label}: gap ${gap}`,
  fixedWidth: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} texts or content frames have a fixed width narrower than their column` : "A text or content frame has a fixed width narrower than its column"} (${HINT_LABEL.listed(examples)}): use fill + max-width, so it follows the column.`,
  fixedWidthExample: (
    label: string,
    width: string,
    room: string,
  ) => `${label} ${width} wide in ${room}`,
  clipped: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} frames of fixed height clip their` : "A frame of fixed height clips its"} content (${HINT_LABEL.listed(examples)}): let the height follow the content, or decide how the build cuts it.`,
  clippedExample: (
    label: string,
    height: string,
    child: string,
  ) => `${label} ${height} tall cuts ${child}`,
  repeated: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} structures are` : "A structure is"} built ${REPEAT_MIN} times or more without a component (${HINT_LABEL.listed(examples)}): build each as one component and use instances.`,
  repeatedExample: (label: string, others: number) => `${label} and ${others} alike`,
  states: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} sets of top-level frames` : "Top-level frames"} of one size share most of their layers (${HINT_LABEL.listed(examples)}): they look like states of one component; build it once, with variants.`,
  statesExample: (labels: readonly string[]) => `${labels.join(" and ")} share most of their layers`,
  fade: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} layers bake fades into images` : "A layer bakes a fade into an image"} (${HINT_LABEL.listed(examples)}): an export flattens the fade and stretches it with the box; export the raw image with original: true and rebuild the gradient in CSS.`,
  fadeOver: (label: string, image: string) => `${label} over ${image}`,
  tiled: (examples: readonly string[]) =>
    `${examples.length > 1 ? `${examples.length} layers are filled with tiled textures` : "A layer is filled with a tiled texture"} (${HINT_LABEL.listed(examples)}): a texture renders coarser or finer at another scale; export one tile at the scale given and repeat it.`,
  tiledImage: (label: string, scale: number) => `${label} tiled at ${scale}×`,
  noise: (label: string, size: string) => `${label} noise of ${size}`,
} as const;
