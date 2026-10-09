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
import { requireNode } from "./nodes.ts";

/** Styles and variables the snapshot's layers use, resolved once at the end; a variable keeps its first consumer. */
interface References {
  readonly styles: Set<string>;
  readonly variables: Map<string, SceneNode>;
}

const SEGMENT_FIELDS: (keyof Omit<StyledTextSegment, "characters" | "start" | "end">)[] = [
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
  const read = (node: SceneNode) =>
    entryOf(node, {
      x: originX ?? 0,
      y: originY ?? 0,
      css,
      references,
    });
  const top = await read(root);
  const queue: { node: SceneNode; entry: SnapshotNode; level: number }[] = [
    {
      node: root,
      entry: top,
      level: 0,
    },
  ];
  let used = JSON.stringify(top).length;
  let full = false;

  for (let index = 0; index < queue.length && !full; index++) {
    const { node, entry, level } = queue[index] as (typeof queue)[number];

    if ((depth !== undefined && level >= depth) || !("children" in node) || (level > 0 && !node.visible)) {
      continue;
    }

    const children: SnapshotNode[] = [];

    for (const child of node.children) {
      const childEntry = await read(child);

      used += JSON.stringify(childEntry).length;

      if (used > SNAPSHOT_MAX_CHARS) {
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

  return {
    root: top,
    styles: await resolveStyles(references.styles),
    variables: await resolveVariables(references.variables),
  };
}

function isLayer(node: BaseNode): node is SceneNode {
  return node.type !== "DOCUMENT" && node.type !== "PAGE";
}

interface EntryContext {
  readonly x: number;
  readonly y: number;
  readonly css: boolean;
  readonly references: References;
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

  if (!node.visible) {
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
        put(key, layer[key]);
      }
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

  if (node.type === "TEXT") {
    entry.text = textOf(node);
  }

  if (node.type === "INSTANCE") {
    const instance = await instanceOf(node);

    if (instance !== null) {
      entry.instance = instance;
    }
  }

  if (context.css && "getCSSAsync" in node) {
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

const GRID_FIELDS = ["gridRowCount", "gridColumnCount", "gridRowGap", "gridColumnGap"] as const;

function textOf(node: TextNode): Record<string, unknown> {
  const text: Record<string, unknown> = {
    characters: node.characters,
    textAutoResize: node.textAutoResize,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    segments: plain(node.getStyledTextSegments(SEGMENT_FIELDS)),
  };

  if (node.textTruncation !== "DISABLED") {
    text.textTruncation = node.textTruncation;
    text.maxLines = node.maxLines;
  }

  if (node.paragraphSpacing !== 0) {
    text.paragraphSpacing = node.paragraphSpacing === figma.mixed ? MIXED : node.paragraphSpacing;
  }

  return text;
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

    if (style === null) {
      continue;
    }

    const base = {
      name: style.name,
      type: style.type,
      remote: style.remote,
    };

    if (style.type === "PAINT") {
      styles[id] = {
        ...base,
        paints: plain<SnapshotStyle["paints"]>(style.paints),
      };
    } else if (style.type === "EFFECT") {
      styles[id] = {
        ...base,
        effects: plain<SnapshotStyle["effects"]>(style.effects),
      };
    } else if (style.type === "TEXT") {
      styles[id] = {
        ...base,
        fontName: { ...style.fontName },
        fontSize: style.fontSize,
        lineHeight: plain<SnapshotStyle["lineHeight"]>(style.lineHeight),
        letterSpacing: plain<SnapshotStyle["letterSpacing"]>(style.letterSpacing),
        textCase: style.textCase,
        textDecoration: style.textDecoration,
      };
    } else {
      styles[id] = base;
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

/** Plugin API values are frozen objects with readonly arrays: a JSON copy is what goes on the wire anyway. */
function plain<T = unknown>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Two decimals: whole pixels are core's decision, not the snapshot's. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
