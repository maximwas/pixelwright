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
export function designHints(
  snapshot: Snapshot,
  read: { readonly xml: string; readonly tokens: Readonly<Record<string, string>> } = designXml(snapshot),
): string[] {
  const { xml } = read;
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
    ...valuelessTokenHints(snapshot, read),
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
  autoLineHeight: (examples: readonly string[]) =>
    `line-height normal is Figma's Auto line height: the font's own spacing, about 1.2× the font size for most fonts (${listed(examples)}); give it in px where the build must match to the pixel (inspect shows each text's).`,
  softBreak: (examples: readonly string[]) =>
    `&#8232; is a line break inside a paragraph (Shift+Enter in Figma, <br> in HTML), not spaces (${listed(examples)}).`,
  overflow: (examples: readonly string[]) =>
    `${examples.length === 1 ? "A layer is" : `${examples.length} layers are`} wider or taller than the room their auto layout parent gives them, so they overflow it in Figma too (${listed(examples)}): decide whether the build wraps, clips or lets them out.`,
} as const;

type LayerHint = keyof typeof LAYER_HINTS;

/** A color written raw that equals a style's or a variable's value. */
/** Paint styles the XML names whose value no layer here could give: a var() the build cannot resolve on its own. */
function valuelessTokenHints(
  snapshot: Snapshot,
  { xml, tokens }: { readonly xml: string; readonly tokens: Readonly<Record<string, string>> },
): string[] {
  const missing = new Map<string, string>();

  for (const style of Object.values(snapshot.styles)) {
    const name = styleTokenName(style);

    if (style.paints !== undefined && tokens[name] === undefined && xml.includes(`var(${name})`)) {
      missing.set(name, (style.paints ?? []).map((paint) => paint.type.toLowerCase()).join(" + ") || "empty");
    }
  }

  return [...missing].map(
    ([name, paints]) =>
      `${name} has no value: its paint style is ${paints}, which neither core nor Figma wrote as CSS here; take its look from a screenshot of a layer that uses it.`,
  );
}

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

  const segments = node.text?.segments ?? [];

  if (segments.some((segment) => segment.lineHeight.unit === "AUTO")) {
    hints.push(["autoLineHeight", label(node)]);
  }

  if ((node.text?.characters ?? "").includes("\u2028")) {
    hints.push(["softBreak", label(node)]);
  }

  const room = parent === null ? null : roomIn(parent);

  if (room !== null && node.layoutPositioning !== "ABSOLUTE") {
    if (node.width > room.width + 0.5) {
      hints.push(["overflow", `${label(node)} ${px(node.width)} wide in ${px(room.width)}`]);
    } else if (node.height > room.height + 0.5) {
      hints.push(["overflow", `${label(node)} ${px(node.height)} tall in ${px(room.height)}`]);
    }
  }

  return hints;
}

/** The box an auto layout parent gives its children: its own less its padding; null when it places them by hand. */
function roomIn(parent: SnapshotNode): { width: number; height: number } | null {
  if (parent.layoutMode === undefined || parent.layoutMode === "NONE") {
    return null;
  }

  return {
    width: parent.width - (parent.paddingLeft ?? 0) - (parent.paddingRight ?? 0),
    height: parent.height - (parent.paddingTop ?? 0) - (parent.paddingBottom ?? 0),
  };
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
