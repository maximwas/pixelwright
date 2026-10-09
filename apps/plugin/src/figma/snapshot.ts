import {
  BridgeError,
  MIXED,
  type OperationInput,
  type OperationOutput,
  type SnapshotNode,
  type SnapshotStyle,
  type SnapshotVariable,
} from "@pixelwright/core";
import { SNAPSHOT_MAX_CHARS } from "../constants/plugin.ts";
import { plain } from "../utils/plain.ts";
import { requireNode } from "./nodes.ts";
import { styleOf } from "./styles.ts";

/** Styles and variables the snapshot's layers use, resolved once at the end; a variable keeps its first consumer. */
interface References {
  readonly styles: Set<string>;
  readonly variables: Map<string, SceneNode>;
}

type SegmentField = keyof Omit<StyledTextSegment, "characters" | "start" | "end">;

/** Paints and effects core writes as CSS itself; anything else asks Figma for its CSS in "unmapped" mode. */
const MAPPED_PAINTS = new Set(["SOLID", "IMAGE"]);
const MAPPED_EFFECTS = new Set(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]);

const BASE_SEGMENT_FIELDS: SegmentField[] = [
  "fontName",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textDecoration",
  "textCase",
  "lineHeight",
  "letterSpacing",
  "fills",
  "fillStyleId",
  "textStyleId",
  "hyperlink",
  "boundVariables",
];

/** Newer fields (text wrap: Aug 2026): a Figma without them refuses the whole call, so they are asked for apart. */
const SEGMENT_FIELDS: SegmentField[] = [
  ...BASE_SEGMENT_FIELDS,
  "textDecorationStyle",
  "textDecorationOffset",
  "textDecorationThickness",
  "textDecorationColor",
  "listOptions",
  "indentation",
  "paragraphIndent",
  "paragraphSpacing",
  "textWrapStyle",
  "openTypeFeatures",
];

/**
 * The raw Figma properties of a layer and its descendants, for core to turn into CSS. Built breadth first under a
 * size budget, like outline: a layer whose children did not fit keeps their count. Hidden layers are a name and a box.
 */
export async function snapshot({
  node: id,
  depth,
  css,
}: OperationInput<"snapshot">): Promise<OperationOutput<"snapshot">> {
  const root = await requireNode(id);

  if (!isLayer(root)) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is a ${root.type.toLowerCase()}: read a layer on a page.`);
  }

  const [[, , originX], [, , originY]] = root.absoluteTransform;
  const references: References = {
    styles: new Set(),
    variables: new Map(),
  };
  const categories = await annotationCategories();
  const top = await subtree(
    root,
    depth,
    (node) =>
      entryOf(node, {
        x: originX ?? 0,
        y: originY ?? 0,
        css,
        references,
        categories,
      }),
    { used: 0 },
  );

  return {
    root: top,
    styles: await resolveStyles(references.styles),
    variables: await resolveVariables(references.variables),
  };
}

/**
 * design_apply's view of the layers it changes, as design_read would see them: each layer asked for that is not inside
 * another one asked for, with its descendants and its parent's own entry, from the parent's origin so they place each
 * other as in a read. The size budget is shared.
 */
export async function entries({ ids }: OperationInput<"entries">): Promise<OperationOutput<"entries">> {
  const asked = new Set(ids);
  const references: References = {
    styles: new Set(),
    variables: new Map(),
  };
  const categories = await annotationCategories();
  const budget = { used: 0 };
  const roots: OperationOutput<"entries">["roots"] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const node = await figma.getNodeByIdAsync(id);

    if (node === null || !isLayer(node)) {
      missing.push(id);
      continue;
    }

    if (inside(node, asked)) {
      continue;
    }

    const parent = node.parent !== null && isLayer(node.parent) ? node.parent : null;
    const [[, , x], [, , y]] = (parent ?? node).absoluteTransform;
    const read = (layer: SceneNode) =>
      entryOf(layer, {
        x: x ?? 0,
        y: y ?? 0,
        css: "none",
        references,
        categories,
        whole: asked.has(layer.id),
      });

    roots.push({
      node: await subtree(node, undefined, read, budget, (layer) => asked.has(layer.id)),
      parent: parent === null ? null : await read(parent),
    });
  }

  return {
    roots,
    missing,
    styles: await resolveStyles(references.styles),
    variables: await resolveVariables(references.variables),
  };
}

function inside(node: BaseNode, asked: ReadonlySet<string>): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (asked.has(current.id)) {
      return true;
    }
  }

  return false;
}

/** A layer and its descendants, breadth first, until the budget (shared by the call) runs out. */
async function subtree(
  root: SceneNode,
  depth: number | undefined,
  read: (node: SceneNode) => Promise<SnapshotNode>,
  budget: { used: number },
  /** A hidden layer whose layers are read all the same. */
  open: (node: SceneNode) => boolean = () => false,
): Promise<SnapshotNode> {
  const top = await read(root);
  const queue: { node: SceneNode; entry: SnapshotNode; level: number }[] = [
    {
      node: root,
      entry: top,
      level: 0,
    },
  ];
  let full = false;

  budget.used += JSON.stringify(top).length;

  for (let index = 0; index < queue.length && !full; index++) {
    const { node, entry, level } = queue[index] as (typeof queue)[number];

    if (
      (depth !== undefined && level >= depth) ||
      !("children" in node) ||
      (level > 0 && !node.visible && !open(node))
    ) {
      continue;
    }

    const children: SnapshotNode[] = [];

    for (const child of node.children) {
      const childEntry = await read(child);

      budget.used += JSON.stringify(childEntry).length;

      if (budget.used > SNAPSHOT_MAX_CHARS) {
        full = true;
        break;
      }

      children.push(childEntry);
      queue.push({
        node: child,
        entry: childEntry,
        level: level + 1,
      });
    }

    if (children.length > 0) {
      entry.children = children;
    }
  }

  return top;
}

function isLayer(node: BaseNode): node is SceneNode {
  return node.type !== "DOCUMENT" && node.type !== "PAGE";
}

interface EntryContext {
  readonly x: number;
  readonly y: number;
  readonly css: OperationInput<"snapshot">["css"];
  readonly references: References;
  /** Annotation category names by id. */
  readonly categories: ReadonlyMap<string, string>;
  /** A hidden layer read whole, not as a name and a box: design_apply changes it. */
  readonly whole?: boolean;
}

async function entryOf(node: SceneNode, context: EntryContext): Promise<SnapshotNode> {
  const [[, , x], [, , y]] = node.absoluteTransform;
  const entry: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    x: round((x ?? 0) - context.x),
    y: round((y ?? 0) - context.y),
    width: round(node.width),
    height: round(node.height),
  };
  const childCount = "children" in node ? node.children.length : 0;

  if (!node.visible && !context.whole) {
    entry.childCount = childCount;

    return entry as unknown as SnapshotNode;
  }

  const layer = node as SceneNode & Record<string, unknown>;
  const put = (key: string, value: unknown, omitted?: unknown) => {
    if (value !== undefined && value !== null && value !== omitted) {
      entry[key] = value === figma.mixed ? MIXED : value;
    }
  };

  put("rotation", layer.rotation, 0);

  const [[a, b], [c, d]] = node.relativeTransform;

  if ((a ?? 1) * (d ?? 1) - (b ?? 0) * (c ?? 0) < 0) {
    entry.mirrorTransform = [a, b, c, d].map((value) => Math.round((value ?? 0) * 10_000) / 10_000);
  }

  if ((entry.rotation !== undefined || entry.mirrorTransform !== undefined) && node.absoluteBoundingBox !== null) {
    const box = node.absoluteBoundingBox;

    entry.bounds = {
      x: round(box.x - context.x),
      y: round(box.y - context.y),
      width: round(box.width),
      height: round(box.height),
    };
  }

  const drawn = ("absoluteRenderBounds" in node ? node.absoluteRenderBounds : null) ?? null;
  const own = node.absoluteBoundingBox;

  if (drawn !== null && own !== null && reachesPast(drawn, own)) {
    entry.renderBounds = {
      x: round(drawn.x - context.x),
      y: round(drawn.y - context.y),
      width: round(drawn.width),
      height: round(drawn.height),
    };
  }

  put("opacity", layer.opacity, 1);

  if (layer.blendMode !== "PASS_THROUGH" && layer.blendMode !== "NORMAL") {
    put("blendMode", layer.blendMode);
  }

  put("isMask", layer.isMask, false);

  if (entry.isMask) {
    put("maskType", layer.maskType);
  }

  put("clipsContent", layer.clipsContent, false);

  const constraints = layer.constraints as Constraints | undefined;

  if (constraints !== undefined && (constraints.horizontal !== "MIN" || constraints.vertical !== "MIN")) {
    entry.constraints = { ...constraints };
  }

  if (typeof layer.layoutMode === "string" && layer.layoutMode !== "NONE") {
    for (const key of AUTO_LAYOUT_FIELDS) {
      put(key, layer[key]);
    }

    if (layer.layoutMode === "GRID") {
      for (const key of GRID_FIELDS) {
        put(key, key.endsWith("Sizes") ? plain(layer[key]) : layer[key]);
      }
    }
  }

  if (node.parent !== null && "layoutMode" in node.parent && node.parent.layoutMode === "GRID") {
    for (const key of GRID_CHILD_FIELDS) {
      put(key, layer[key]);
    }
  }

  put("layoutSizingHorizontal", layer.layoutSizingHorizontal);
  put("layoutSizingVertical", layer.layoutSizingVertical);
  put("layoutPositioning", layer.layoutPositioning, "AUTO");
  put("layoutGrow", layer.layoutGrow, 0);
  put("layoutAlign", layer.layoutAlign, "INHERIT");

  for (const key of ["minWidth", "maxWidth", "minHeight", "maxHeight"]) {
    put(key, layer[key]);
  }

  putPaints(entry, "fills", layer.fills);
  putPaints(entry, "strokes", layer.strokes);

  if (Array.isArray(entry.strokes)) {
    put("strokeWeight", layer.strokeWeight);

    if (entry.strokeWeight === MIXED) {
      for (const key of ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"]) {
        put(key, layer[key]);
      }
    }

    put("strokeAlign", layer.strokeAlign);

    if (Array.isArray(layer.dashPattern) && layer.dashPattern.length > 0) {
      entry.dashPattern = [...layer.dashPattern];
    }
  }

  putPaints(entry, "effects", layer.effects);
  put("cornerRadius", layer.cornerRadius, 0);

  if (entry.cornerRadius === MIXED) {
    for (const key of ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"]) {
      put(key, layer[key]);
    }
  }

  put("cornerSmoothing", layer.cornerSmoothing, 0);

  for (const key of ["fillStyleId", "strokeStyleId", "effectStyleId", "textStyleId"]) {
    put(key, layer[key], "");
  }

  if (isFilled(layer.boundVariables)) {
    entry.boundVariables = plain(layer.boundVariables);
  }

  if (Array.isArray(layer.exportSettings) && layer.exportSettings.length > 0) {
    entry.exportSettings = plain(layer.exportSettings);
  }

  if ((node.type === "COMPONENT" || node.type === "COMPONENT_SET") && node.description !== "") {
    entry.description = node.description;
  }

  if (
    layer.layoutMode === "NONE" &&
    typeof layer.inferredAutoLayout === "object" &&
    layer.inferredAutoLayout !== null
  ) {
    const inferred = layer.inferredAutoLayout as InferredAutoLayoutResult;

    if (inferred.layoutMode !== "NONE") {
      entry.inferredLayout = {
        layoutMode: inferred.layoutMode,
        itemSpacing: inferred.itemSpacing,
        primaryAxisAlignItems: inferred.primaryAxisAlignItems,
        counterAxisAlignItems: inferred.counterAxisAlignItems,
        paddingTop: inferred.paddingTop,
        paddingRight: inferred.paddingRight,
        paddingBottom: inferred.paddingBottom,
        paddingLeft: inferred.paddingLeft,
      };
    }
  }

  put("detached", layer.detachedInfo === null || layer.detachedInfo === undefined ? undefined : true);
  put("missingFont", node.type === "TEXT" && node.hasMissingFont ? true : undefined);

  const notes = annotationsOf(node, context.categories);

  if (notes.length > 0) {
    entry.annotations = notes;
  }

  const href = urlOf(node);

  if (href !== null) {
    entry.href = href;
  }

  if (node.type === "TEXT") {
    entry.text = textOf(node);
  }

  if (node.type === "INSTANCE") {
    const instance = await instanceOf(node);

    if (instance !== null) {
      entry.instance = instance;
    }
  }

  if ((context.css === "all" || (context.css === "unmapped" && needsOracle(entry))) && "getCSSAsync" in node) {
    entry.css = await node.getCSSAsync();
  }

  entry.childCount = childCount;
  collect(entry, node, context.references);

  // The server checks the whole snapshot against SnapshotSchema; here it is raw Plugin API data.
  return entry as unknown as SnapshotNode;
}

const AUTO_LAYOUT_FIELDS = [
  "layoutMode",
  "layoutWrap",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "counterAxisAlignContent",
  "itemSpacing",
  "counterAxisSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "itemReverseZIndex",
  "strokesIncludedInLayout",
] as const;

const GRID_FIELDS = [
  "gridRowCount",
  "gridColumnCount",
  "gridRowGap",
  "gridColumnGap",
  "gridRowSizes",
  "gridColumnSizes",
] as const;

const GRID_CHILD_FIELDS = [
  "gridRowAnchorIndex",
  "gridColumnAnchorIndex",
  "gridRowSpan",
  "gridColumnSpan",
  "gridChildHorizontalAlign",
  "gridChildVerticalAlign",
] as const;

/** Whether a layer has what core cannot write as CSS yet, so Figma's own CSS is worth its time. */
function needsOracle(entry: Record<string, unknown>): boolean {
  const paints = (value: unknown) =>
    value === MIXED ||
    (Array.isArray(value) && value.some((paint: { type: string }) => !MAPPED_PAINTS.has(paint.type)));
  const effects = Array.isArray(entry.effects) ? (entry.effects as { type: string; blurType?: string }[]) : [];
  const segments = (entry.text as { segments?: { fills: unknown }[] } | undefined)?.segments ?? [];

  return (
    paints(entry.fills) ||
    paints(entry.strokes) ||
    entry.blendMode !== undefined ||
    effects.some((effect) => !MAPPED_EFFECTS.has(effect.type) || effect.blurType === "PROGRESSIVE") ||
    segments.some((segment) => paints(segment.fills))
  );
}

async function annotationCategories(): Promise<ReadonlyMap<string, string>> {
  // Older Figma versions and the tests' fake have no annotations API.
  const categories = await figma.annotations?.getAnnotationCategoriesAsync().catch(() => []);

  return new Map((categories ?? []).map((category) => [category.id, category.label]));
}

function annotationsOf(
  node: SceneNode,
  categories: ReadonlyMap<string, string>,
): { label: string; category?: string }[] {
  if (!("annotations" in node)) {
    return [];
  }

  return node.annotations.flatMap((annotation) => {
    const label = annotation.label ?? annotation.labelMarkdown;
    const category = annotation.categoryId === undefined ? undefined : categories.get(annotation.categoryId);

    return label === undefined || label === ""
      ? []
      : [
          {
            label,
            ...(category === undefined ? {} : { category }),
          },
        ];
  });
}

/** The URL a prototype interaction of the layer opens, if one does. */
function urlOf(node: SceneNode): string | null {
  if (!("reactions" in node)) {
    return null;
  }

  for (const reaction of node.reactions) {
    for (const action of reaction.actions ?? (reaction.action === undefined ? [] : [reaction.action])) {
      if (action.type === "URL") {
        return action.url;
      }
    }
  }

  return null;
}

function textOf(node: TextNode): Record<string, unknown> {
  const text: Record<string, unknown> = {
    characters: node.characters,
    textAutoResize: node.textAutoResize,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    segments: plain(segmentsOf(node)),
  };

  if (node.textTruncation !== "DISABLED") {
    text.textTruncation = node.textTruncation;
    text.maxLines = node.maxLines;
  }

  if (node.leadingTrim !== "NONE" && typeof node.leadingTrim === "string") {
    text.leadingTrim = node.leadingTrim;
  }

  if (node.hangingPunctuation) {
    text.hangingPunctuation = true;
  }

  if (node.paragraphSpacing !== 0) {
    text.paragraphSpacing = node.paragraphSpacing === figma.mixed ? MIXED : node.paragraphSpacing;
  }

  return text;
}

function segmentsOf(node: TextNode) {
  try {
    return node.getStyledTextSegments(SEGMENT_FIELDS);
  } catch {
    return node.getStyledTextSegments(BASE_SEGMENT_FIELDS);
  }
}

async function instanceOf(node: InstanceNode): Promise<Record<string, unknown> | null> {
  const main = await node.getMainComponentAsync();

  if (main === null) {
    return null;
  }

  const set = main.parent?.type === "COMPONENT_SET" ? main.parent : null;

  return {
    componentId: main.id,
    componentName: main.name,
    componentKey: main.key,
    ...(set === null
      ? {}
      : {
          setId: set.id,
          setName: set.name,
        }),
    properties: Object.fromEntries(
      Object.entries(node.componentProperties).map(([name, property]) => [
        name,
        {
          type: property.type,
          value: property.value,
        },
      ]),
    ),
  };
}

function putPaints(entry: Record<string, unknown>, key: string, value: unknown): void {
  if (value === figma.mixed) {
    entry[key] = MIXED;
  } else if (Array.isArray(value) && value.length > 0) {
    entry[key] = plain(value);
  }
}

/** Every style id and variable alias inside an entry: its own fields, paints, effects and text segments. */
function collect(value: unknown, node: SceneNode, references: References): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, node, references);
    }

    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;

  if (record.type === "VARIABLE_ALIAS" && typeof record.id === "string") {
    if (!references.variables.has(record.id)) {
      references.variables.set(record.id, node);
    }

    return;
  }

  for (const [key, item] of Object.entries(record)) {
    if (key.endsWith("StyleId")) {
      if (typeof item === "string" && item !== "" && item !== MIXED) {
        references.styles.add(item);
      }
    } else if (key !== "css" && key !== "characters") {
      collect(item, node, references);
    }
  }
}

async function resolveStyles(ids: ReadonlySet<string>): Promise<Record<string, SnapshotStyle>> {
  const styles: Record<string, SnapshotStyle> = {};

  for (const id of ids) {
    const style = await figma.getStyleByIdAsync(id);

    if (style !== null) {
      styles[id] = styleOf(style);
    }
  }

  return styles;
}

async function resolveVariables(consumers: ReadonlyMap<string, SceneNode>): Promise<Record<string, SnapshotVariable>> {
  const variables: Record<string, SnapshotVariable> = {};

  for (const [id, consumer] of consumers) {
    const variable = await figma.variables.getVariableByIdAsync(id);

    if (variable === null) {
      continue;
    }

    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    let value: unknown;

    try {
      value = plain(variable.resolveForConsumer(consumer).value);
    } catch {
      // Figma cannot resolve some variables for some layers (a mode the layer does not have): the name still names it.
    }

    variables[id] = {
      name: variable.name,
      collection: collection?.name ?? "",
      resolvedType: variable.resolvedType,
      remote: variable.remote,
      ...(value === undefined ? {} : { value }),
      ...(isFilled(variable.codeSyntax) ? { codeSyntax: { ...variable.codeSyntax } } : {}),
    };
  }

  return variables;
}

function isFilled(value: unknown): value is object {
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}

/** Whether a layer draws past its own box by more than half a pixel (centred or outside strokes, shadows). */
function reachesPast(drawn: Rect, own: Rect): boolean {
  return (
    Math.abs(drawn.x - own.x) > 0.5 ||
    Math.abs(drawn.y - own.y) > 0.5 ||
    Math.abs(drawn.width - own.width) > 0.5 ||
    Math.abs(drawn.height - own.height) > 0.5
  );
}

/** Two decimals: whole pixels are core's decision, not the snapshot's. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
