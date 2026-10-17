import type { ApplyChange, FigmaProps } from "@pixelwright/core";
import { assign } from "../../figma/assign.ts";
import { hasFills } from "../../figma/capabilities.ts";
import type { ComponentIndex } from "../../figma/component-index.ts";
import { variantFor } from "../../figma/variants.ts";
import { WriteError } from "../../figma/write-error.ts";
import type { Placement } from "./placement.ts";

/** Room left between the page's layers and a new one placed beside them. */
export const PAGE_GAP = 100;

const MAKERS: Readonly<Record<string, () => SceneNode>> = {
  Frame: () => figma.createFrame(),
  Section: () => figma.createSection(),
  Text: () => figma.createText(),
  Rectangle: () => figma.createRectangle(),
  Ellipse: () => figma.createEllipse(),
  Line: () => figma.createLine(),
  Component: () => figma.createComponent(),
  // A frame holds a new set's variants until they are combined into the set.
  ComponentSet: () => figma.createFrame(),
  // An image fills a rectangle; its file is written as its fill.
  Image: () => figma.createRectangle(),
};

/** The type each tag's new layer is made as: an image fills a rectangle, an icon's SVG makes a frame. */
const NEW_TYPES: Readonly<Record<string, SceneNode["type"]>> = {
  Frame: "FRAME",
  Section: "SECTION",
  Text: "TEXT",
  Rectangle: "RECTANGLE",
  Ellipse: "ELLIPSE",
  Line: "LINE",
  Component: "COMPONENT",
  Image: "RECTANGLE",
  Icon: "FRAME",
  Slot: "SLOT",
  Instance: "INSTANCE",
};

/** The type a new layer of this tag is made as; null for a set, whose frame becomes a set once its variants are in. */
export function newLayerType(tag: string): SceneNode["type"] | null {
  return NEW_TYPES[tag] ?? null;
}

/** What a new layer is made of besides its change: the call's components and images. */
export interface Making {
  readonly components: ComponentIndex;
  image(asset: { readonly src: string; readonly stream?: string }): Image;
}

/** Whether a tag is a layer design_apply makes. */
export function canMake(tag: string): boolean {
  return MAKERS[tag] !== undefined || tag === "Icon" || tag === "Slot";
}

/** A layer made from nothing; a copy, an instance or a slot starts as its source, component or component's slot. */
export function bare(change: ApplyChange): boolean {
  return change.copyOf === undefined && change.tag !== "Instance" && change.tag !== "Slot";
}

/**
 * A new layer in its place: made, inserted at once (taken away again when Figma refuses it there), started bare when
 * made from nothing, named after its file when the XML names it not.
 */
export async function createLayer(change: ApplyChange, placement: Placement, making: Making): Promise<SceneNode> {
  const { parent, index } = await placement.whereTo(change);

  if (!("insertChild" in parent) || typeof parent.insertChild !== "function") {
    throw new WriteError(`A ${parent.type.toLowerCase()} holds no layers: put the new one in a frame.`);
  }

  const node = await makeLayer(change, parent, making);

  try {
    parent.insertChild(index, node);
  } catch (error) {
    node.remove();

    throw error;
  }

  if (bare(change)) {
    startBare(node, change.props);
  }

  if (change.props.name === undefined && change.props.asset !== undefined) {
    node.name = fileName(change.props.asset.src);
  }

  return node;
}

/** A new layer: a copy of its source, an instance of its component, an icon from its SVG, a slot of its component. */
async function makeLayer(change: ApplyChange, parent: BaseNode, making: Making): Promise<SceneNode> {
  if (change.copyOf !== undefined) {
    return await copyOf(change.copyOf);
  }

  if (change.tag === "Instance") {
    return variantFor(
      await making.components.find(change.props.component ?? ""),
      change.props.variant ?? {},
    ).createInstance();
  }

  if (change.tag === "Icon") {
    return figma.createNodeFromSvg(svgOf(change.props));
  }

  if (change.tag === "Image") {
    // Its file first: one that did not come, or that Figma refuses, leaves no empty rectangle.
    making.image(assetOf(change.props));

    return figma.createRectangle();
  }

  if (change.tag === "Slot") {
    return slotIn(parent);
  }

  const make = MAKERS[change.tag];

  if (make === undefined) {
    throw new WriteError(`Creating a ${change.tag} is not available.`);
  }

  return make();
}

async function copyOf(id: string): Promise<SceneNode> {
  const source = await figma.getNodeByIdAsync(id);

  if (source === null || source.type === "PAGE" || source.type === "DOCUMENT") {
    throw new WriteError(`No layer ${id} to copy.`, "copyOf names a layer by its id, as design_read writes it.");
  }

  return (source as SceneNode).clone();
}

function slotIn(parent: BaseNode): SceneNode {
  if (parent.type !== "COMPONENT") {
    throw new WriteError(
      "A slot is made in a component.",
      'In an instance, fill the slot it has: give its <Slot id="…"> new layers.',
    );
  }

  return parent.createSlot();
}

function assetOf(props: FigmaProps): { readonly src: string; readonly stream?: string } {
  if (props.asset === undefined) {
    throw new WriteError("An <Image> is made from its file: give it src.");
  }

  return props.asset;
}

/** The SVG an Icon is drawn from, carried on its change. */
function svgOf(props: FigmaProps): string {
  const svg = props.asset?.svg;

  if (svg === undefined) {
    throw new WriteError(`${props.asset?.src ?? "The icon's file"} did not reach the plugin.`);
  }

  return svg;
}

/** A file's name without its folder and extension: a new Image's or Icon's layer name when the XML gives none. */
function fileName(src: string): string {
  return (src.split(/[\\/]/).at(-1) ?? src).replace(/\.[^.]+$/, "");
}

/** What the XML leaves out a new layer does not have: no fill without a background, no clipping without overflow. */
function startBare(node: SceneNode, props: FigmaProps): void {
  if (props.fills === undefined && node.type !== "TEXT" && node.type !== "LINE" && hasFills(node)) {
    node.fills = [];
  }

  if (props.strokes === undefined && node.type === "LINE") {
    node.strokes = [];
  }

  if (props.clipsContent === undefined && node.type === "FRAME") {
    node.clipsContent = false;
  }

  if (node.type === "TEXT") {
    node.textAutoResize = "WIDTH_AND_HEIGHT";
  }
}

/**
 * A new auto layout frame hugs what the XML did not size (a copy or an instance keeps its own sizing); a new layer on
 * the page goes beside what is there.
 */
export function finishNew(node: SceneNode, change: ApplyChange): void {
  if (bare(change)) {
    hugUnsized(node, change.props);
  }

  placeOnPage(node, change.props);
}

function hugUnsized(node: SceneNode, props: FigmaProps): void {
  if (!("layoutMode" in node) || typeof node.layoutMode !== "string" || node.layoutMode === "NONE") {
    return;
  }

  const parent = node.parent;
  const direction = parent !== null && "layoutMode" in parent ? parent.layoutMode : undefined;
  // In a grid, justify-self fills the cell's width and align-self its height; across a flex parent, align-self.
  const stretched = (axis: "horizontal" | "vertical") =>
    direction === "GRID"
      ? (axis === "horizontal" ? props.justifySelf : props.alignSelf) === "STRETCH"
      : props.alignSelf === "STRETCH" && direction === (axis === "horizontal" ? "VERTICAL" : "HORIZONTAL");
  const fills = (axis: "horizontal" | "vertical") =>
    ((props.grow ?? false) && direction === (axis === "horizontal" ? "HORIZONTAL" : "VERTICAL")) ||
    stretched(axis) ||
    props[axis]?.kind === "STRETCH" ||
    props[axis]?.kind === "SCALE";

  if (props.width === undefined && !fills("horizontal")) {
    assign(node, "layoutSizingHorizontal", "HUG");
  }

  if (props.height === undefined && !fills("vertical")) {
    assign(node, "layoutSizingVertical", "HUG");
  }
}

function placeOnPage(node: SceneNode, props: FigmaProps): void {
  const parent = node.parent;

  if (parent?.type !== "PAGE" || props.horizontal !== undefined) {
    return;
  }

  const others = parent.children.filter((child) => child.id !== node.id);
  const right = Math.max(...others.map((child) => child.x + child.width), -PAGE_GAP);

  node.x = Math.round(right + PAGE_GAP);
  node.y = Math.round(Math.min(...others.map((child) => child.y), 0));
}
