import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

export const ASSET_KIND = { icon: "icon", image: "image", video: "video" } as const;

export const ASSET_FORMAT = { svg: "SVG", png: "PNG", pdf: "PDF" } as const;

/** The element an exported asset is written as. */
export const ASSET_TAG = { icon: "Icon", image: "Image" } as const;

/** What the classes read from Figma's layers, paints and export settings. */
export const ASSET_FIGMA = {
  image: "IMAGE",
  video: "VIDEO",
  group: "GROUP",
  scale: "SCALE",
  variant: "VARIANT",
} as const;

/** The classes a layer can be (C-142): a render, a vector file, or a video no file can hold (B-001, D-23). */
export const ASSET_CLASS = {
  rendered: { kind: ASSET_KIND.image, format: ASSET_FORMAT.png },
  vector: { kind: ASSET_KIND.icon, format: ASSET_FORMAT.svg },
  video: { kind: ASSET_KIND.video },
} as const;

/** Paints CSS cannot draw: a leaf filled with one is rendered (gradients stay CSS; a video is marked apart, D-23). */
export const RENDERED_PAINTS = { PATTERN: true, SHADER: true } as const;

/** Effects CSS cannot draw: a leaf with one is rendered. */
export const RENDERED_EFFECTS = { NOISE: true, TEXTURE: true, GLASS: true, SHADER: true } as const;

/** True vectors: one of them makes a container of shapes a drawing. */
export const VECTOR_TYPES = {
  VECTOR: true,
  BOOLEAN_OPERATION: true,
  STAR: true,
  POLYGON: true,
  TRANSFORM_GROUP: true,
} as const;

/** Containers that are one drawing when everything in them is a shape: a logo instance, an icon group. */
export const DRAWING_CONTAINERS = { GROUP: true, FRAME: true, INSTANCE: true, COMPONENT: true } as const;

/** Shapes an icon may be drawn with, besides true vectors. */
export const ICON_SHAPES = {
  ...VECTOR_TYPES,
  ...DRAWING_CONTAINERS,
  ELLIPSE: true,
  RECTANGLE: true,
  LINE: true,
} as const;

/**
 * What an exported icon keeps of its CSS (C-143): where it sits and how big it is. The file holds how it looks, its
 * opacity, blur and inner shadows included; no file holds how it blends with what is under it.
 */
export const ICON_KEEPS: readonly string[] = [
  CSS_PROPERTY.position,
  CSS_PROPERTY.left,
  CSS_PROPERTY.top,
  CSS_PROPERTY.width,
  CSS_PROPERTY.height,
  CSS_PROPERTY.minWidth,
  CSS_PROPERTY.maxWidth,
  CSS_PROPERTY.minHeight,
  CSS_PROPERTY.maxHeight,
  CSS_PROPERTY.flex,
  CSS_PROPERTY.alignSelf,
  CSS_PROPERTY.gridRow,
  CSS_PROPERTY.gridColumn,
  CSS_PROPERTY.justifySelf,
  CSS_PROPERTY.transform,
  CSS_PROPERTY.mixBlendMode,
];

/** An image render is clipped to its own box: corners, drop shadows and outlines outside it stay CSS around it. */
export const IMAGE_KEEPS: readonly string[] = [
  ...ICON_KEEPS,
  CSS_PROPERTY.borderRadius,
  CSS_PROPERTY.boxShadow,
  CSS_PROPERTY.outline,
];

export const ASSET_VALUE = {
  /** Where the XML says files go; the files are written by assets_export. */
  path: "assets",
  /** The second file of a name is `-2`: the first keeps the bare name (0.7.0, C-144). */
  firstNumber: 2,
  /** An export at the layer's own size. */
  naturalScale: 1,
  inset: "inset",
  shadowJoint: ", ",
  wordJoint: " ",
  none: "",
} as const;

export const ASSET_TEXT = {
  file: (path: string, name: string) => `${path}/${name}`,
  name: (base: string, extension: string) => `${base}.${extension}`,
  numbered: (
    base: string,
    number: number,
    extension: string,
  ) => `${base}-${number}.${extension}`,
  background: (base: string) => `${base}-background`,
} as const;
