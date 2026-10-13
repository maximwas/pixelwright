import { colorCss } from "../css/color.ts";
import { boxShorthand, px } from "../css/format.ts";
import { styleTokenName, variableTokenName } from "../css/tokens.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import { classify, visibleChildren } from "./classify.ts";
import { designXml } from "./design.ts";

/** Figma's names for layers nobody named: `Frame 427`, `Rectangle 22957`. */
const DEFAULT_NAME =
  /^(Frame|Group|Rectangle|Ellipse|Vector|Line|Polygon|Star|Component|Instance|Section|Union|Subtract|Intersect|Exclude) \d+$/;

/** How many examples a hint names. */
const EXAMPLES = 3;

const label = (node: SnapshotNode) => `${node.id} "${node.name}"`;

/**
 * What Figma does not bind and the code should: raw values equal to tokens, unnamed layers, frames placed by hand,
 * backgrounds drawn as rectangles, bare wrappers, missing fonts, detached components. Hints never change the XML.
 */
export function designHints(snapshot: Snapshot, xml = designXml(snapshot).xml): string[] {
  const all: { node: SnapshotNode; parent: SnapshotNode | null }[] = [];
  const walk = (node: SnapshotNode, parent: SnapshotNode | null) => {
    // An asset is one file: how it is built inside does not reach the code.
    if (!node.visible || classify(node, snapshot.root) !== null) {
      return;
    }

    all.push({
      node,
      parent,
    });

    for (const child of node.children ?? []) {
      walk(child, node);
    }
  };

  walk(snapshot.root, null);

  const found = new Map<LayerHint, string[]>();

  for (const { node, parent } of all) {
    for (const [kind, example] of layerHints(node, parent, snapshot.root)) {
      found.set(kind, [...(found.get(kind) ?? []), example]);
    }
  }

  return [
    ...rawTokenHints(snapshot, xml),
    ...defaultNameHints(all.map(({ node }) => node)),
    ...[...found].map(([kind, examples]) => LAYER_HINTS[kind](examples)),
    ...missingFontHints(all.map(({ node }) => node)),
  ];
}

/** A few of the layers a hint is about, and how many more. */
const listed = (examples: readonly string[]) =>
  `${examples.slice(0, EXAMPLES).join("; ")}${examples.length > EXAMPLES ? `; and ${examples.length - EXAMPLES} more` : ""}`;

/** One hint per kind, however many layers it is about. */
const LAYER_HINTS = {
  manual: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A frame has" : `${examples.length} frames have`} no auto layout, so their children are placed absolutely (${listed(examples)}): build them as a flow if they are meant to resize.`,
  background: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A rectangle covers its parent" : `${examples.length} rectangles cover their parents`} under the content (${listed(examples)}): write each as its parent's background, not as an element.`,
  wrapper: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A frame only wraps" : `${examples.length} frames only wrap`} one layer (${listed(examples)}): they may not need elements of their own.`,
  detached: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A frame was" : `${examples.length} frames were`} detached from a component (${listed(examples)}): check whether the component fits instead.`,
} as const;

type LayerHint = keyof typeof LAYER_HINTS;

/** A color written raw that equals a style's or a variable's value. */
function rawTokenHints(snapshot: Snapshot, xml: string): string[] {
  const tokens = new Map<string, string>();

  for (const style of Object.values(snapshot.styles)) {
    const [paint, ...rest] = style.paints ?? [];

    if (rest.length === 0 && paint?.type === "SOLID" && paint.color !== undefined) {
      tokens.set(colorCss(paint.color, paint.opacity ?? 1), styleTokenName(style));
    }
  }

  for (const variable of Object.values(snapshot.variables)) {
    const value = variable.value;

    if (variable.resolvedType === "COLOR" && typeof value === "object" && value !== null && "r" in value) {
      tokens.set(colorCss(value as { r: number; g: number; b: number; a?: number }), variableTokenName(variable));
    }
  }

  const uses = new Map<string, string[]>();

  for (const line of xml.split("\n")) {
    const id = /\bid="([^"]+)"/.exec(line)?.[1];

    for (const [, property, value] of line.matchAll(/ ([a-z-]+)="([^"]*)"/g)) {
      for (const [color] of (value ?? "").replace(/var\([^)]*\)/g, "").matchAll(/#[0-9A-F]{3,8}\b|rgba\([^)]*\)/g)) {
        if (tokens.has(color)) {
          uses.set(color, [...(uses.get(color) ?? []), `${property} of ${id}`]);
        }
      }
    }
  }

  return [...uses].map(
    ([color, places]) =>
      `${color} is written raw ${places.length === 1 ? "once" : `${places.length} times`} (${places.slice(0, EXAMPLES).join(", ")}) and equals ${tokens.get(color)}: use the token.`,
  );
}

function defaultNameHints(nodes: readonly SnapshotNode[]): string[] {
  const unnamed = nodes.filter((node) => DEFAULT_NAME.test(node.name));

  if (unnamed.length === 0) {
    return [];
  }

  const examples = unnamed.slice(0, EXAMPLES).map(label).join(", ");

  return [
    `${unnamed.length} layers keep Figma's default names (${examples}${unnamed.length > EXAMPLES ? ", …" : ""}): name the elements by their role in the code.`,
  ];
}

function layerHints(node: SnapshotNode, parent: SnapshotNode | null, root: SnapshotNode): [LayerHint, string][] {
  const hints: [LayerHint, string][] = [];
  const children = visibleChildren(node);
  const container = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";

  if (container && node.layoutMode === undefined && children.length >= 2) {
    const guess =
      node.inferredLayout === undefined ? "" : `, Figma reads it as ${guessCss(node.inferredLayout, children.length)}`;

    hints.push(["manual", `${label(node)} with ${children.length} children${guess}`]);
  }

  const [first] = children;

  if (first !== undefined && children.length >= 2 && coversAsBackground(first, node)) {
    hints.push(["background", `${label(first)} covers ${label(node)}`]);
  }

  if (
    node.type === "FRAME" &&
    node !== root &&
    children.length === 1 &&
    node.childCount === 1 &&
    isBare(node) &&
    parent !== null
  ) {
    hints.push(["wrapper", `${label(node)} only wraps ${children[0]?.id}`]);
  }

  if (node.detached) {
    hints.push(["detached", label(node)]);
  }

  return hints;
}

/** A rectangle with a plain fill under the rest, the size of its parent: a background drawn as a layer. */
function coversAsBackground(layer: SnapshotNode, parent: SnapshotNode): boolean {
  const placed = parent.layoutMode === undefined || layer.layoutPositioning === "ABSOLUTE";
  const solid =
    Array.isArray(layer.fills) && layer.fills.length > 0 && layer.fills.every((paint) => paint.type === "SOLID");
  const close = (a: number, b: number) => Math.abs(a - b) <= 1;

  return (
    layer.type === "RECTANGLE" &&
    placed &&
    solid &&
    close(layer.x, parent.x) &&
    close(layer.y, parent.y) &&
    close(layer.width, parent.width) &&
    close(layer.height, parent.height)
  );
}

/** A frame that draws nothing and spaces nothing. */
function isBare(node: SnapshotNode): boolean {
  const paints = (value: SnapshotNode["fills"]) => value !== undefined && (value === "mixed" || value.length > 0);
  const padded = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].some(
    (side) => (side ?? 0) > 0,
  );

  return (
    !paints(node.fills) && !paints(node.strokes) && (node.effects ?? []).length === 0 && !padded && !node.clipsContent
  );
}

function guessCss(guess: NonNullable<SnapshotNode["inferredLayout"]>, children: number): string {
  const parts = ["display: flex"];
  const sides = [guess.paddingTop, guess.paddingRight, guess.paddingBottom, guess.paddingLeft].map((side) =>
    px(side ?? 0),
  );
  const justify: Record<string, string> = {
    CENTER: "center",
    MAX: "flex-end",
    SPACE_BETWEEN: "space-between",
  };
  const align: Record<string, string> = {
    CENTER: "center",
    MAX: "flex-end",
    BASELINE: "baseline",
  };

  if (guess.layoutMode === "VERTICAL") {
    parts.push("flex-direction: column");
  }

  if (sides.some((side) => side !== "0")) {
    parts.push(`padding: ${boxShorthand(...(sides as [string, string, string, string]))}`);
  }

  const justified = justify[guess.primaryAxisAlignItems ?? "MIN"];
  const aligned = align[guess.counterAxisAlignItems ?? "MIN"];

  if (justified !== undefined) {
    parts.push(`justify-content: ${justified}`);
  }

  if (aligned !== undefined) {
    parts.push(`align-items: ${aligned}`);
  }

  if (children >= 2 && (guess.itemSpacing ?? 0) > 0 && guess.primaryAxisAlignItems !== "SPACE_BETWEEN") {
    parts.push(`gap: ${px(guess.itemSpacing ?? 0)}`);
  }

  return parts.join("; ");
}

function missingFontHints(nodes: readonly SnapshotNode[]): string[] {
  const missing = nodes.filter((node) => node.missingFont);

  if (missing.length === 0) {
    return [];
  }

  const families = [
    ...new Set(missing.flatMap((node) => node.text?.segments.map((segment) => segment.fontName.family) ?? [])),
  ];

  return [
    `Fonts missing on this machine${families.length > 0 ? ` (${families.join(", ")})` : ""} in ${missing
      .slice(0, EXAMPLES)
      .map(label)
      .join(", ")}: Figma could not lay these texts out, so their sizes may be off.`,
  ];
}
