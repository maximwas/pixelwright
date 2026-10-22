import { px } from "../../css-mapping/values/format.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { visibleChildren } from "../assets/classify.ts";
import { overrideWords } from "../overrides.ts";
import { EXAMPLES, labelOf, listed } from "./examples.ts";
import { guessedLayoutCss } from "./layout-guess.ts";

/** Figma's names for layers nobody named: `Frame 427`, `Rectangle 22957`. */
export const DEFAULT_NAME =
  /^(Frame|Group|Rectangle|Ellipse|Vector|Line|Polygon|Star|Component|Instance|Section|Union|Subtract|Intersect|Exclude) \d+$/;

/** A layer the read shows as a layer, with the parent it sits in. */
export interface ShownLayer {
  readonly node: SnapshotNode;
  readonly parent: SnapshotNode | null;
}

/** What a hint looks at on a layer: the layer, its parent, the read's root and the layer's shown children. */
interface LayerScope extends ShownLayer {
  readonly root: SnapshotNode;
  readonly children: readonly SnapshotNode[];
}

/** A kind of hint about layers: the example a layer gives of it (null for none), and the hint for all of them. */
interface LayerHint {
  readonly find: (scope: LayerScope) => string | null;
  readonly say: (examples: readonly string[]) => string;
}

/** The kinds in the order a layer is checked for them: a hint comes where its first layer does, then in this order. */
const LAYER_HINTS: Readonly<Record<string, LayerHint>> = {
  manual: {
    find: placedByHand,
    say: (examples) =>
      `${examples.length === 1 ? "A frame has no auto layout, so its children are" : `${examples.length} frames have no auto layout, so their children are`} placed absolutely (${listed(examples)}): build them as a flow if they are meant to resize.`,
  },
  overridden: {
    find: ({ node }) => {
      const words = overrideWords(node);

      return words.length === 0 ? null : `${labelOf(node)}: ${words.join(", ")}`;
    },
    say: (examples) =>
      `${examples.length === 1 ? "A layer inside an instance differs from its" : `${examples.length} layers inside instances differ from their`} component outside its properties (${listed(examples)}): give the component a property or a variant for them, or build them as one-offs.`,
  },
  background: {
    find: ({ node, children }) => {
      const [first] = children;

      return first !== undefined && children.length >= 2 && coversAsBackground(first, node)
        ? `${labelOf(first)} covers ${labelOf(node)}`
        : null;
    },
    say: (examples) =>
      `${examples.length === 1 ? "A rectangle covers its parent" : `${examples.length} rectangles cover their parents`} under the content (${listed(examples)}): write each as its parent's background, not as an element.`,
  },
  wrapper: {
    find: ({ node, parent, root, children }) =>
      node.type === "FRAME" &&
      node !== root &&
      children.length === 1 &&
      node.childCount === 1 &&
      isBare(node) &&
      parent !== null
        ? `${labelOf(node)} only wraps ${children[0]?.id}`
        : null,
    say: (examples) =>
      `${examples.length === 1 ? "A frame only wraps" : `${examples.length} frames only wrap`} one layer (${listed(examples)}): they may not need elements of their own.`,
  },
  centredStroke: {
    find: ({ node }) =>
      node.strokeAlign === "CENTER" &&
      Array.isArray(node.strokes) &&
      node.strokes.some((paint) => paint.visible ?? true)
        ? labelOf(node)
        : null,
    say: (examples) =>
      `${examples.length === 1 ? "A layer has a stroke centred on its edge" : `${examples.length} layers have strokes centred on their edges`} (${listed(examples)}): Figma paints half of it outside the box, a CSS border all inside; where it must match to the pixel, use an outline with outline-offset of minus half its width.`,
  },
  detached: {
    find: ({ node }) => (node.detached ? labelOf(node) : null),
    say: (examples) =>
      `${examples.length === 1 ? "A frame was" : `${examples.length} frames were`} detached from a component (${listed(examples)}): check whether the component fits instead.`,
  },
  autoLineHeight: {
    // A text on a path has no line height: Figma reads its segments as Auto all the same.
    find: ({ node }) =>
      node.type === "TEXT" && (node.text?.segments ?? []).some((segment) => segment.lineHeight.unit === "AUTO")
        ? labelOf(node)
        : null,
    say: (examples) =>
      `line-height normal is Figma's Auto line height: the font's own spacing, about 1.2× the font size for most fonts (${listed(examples)}); where the build must match to the pixel, read with autoLineHeight: "px", which writes the px Figma renders where the read can tell (a text that hugs its lines shows it for its font and size).`,
  },
  softBreak: {
    find: ({ node }) => ((node.text?.characters ?? "").includes("\u2028") ? labelOf(node) : null),
    say: (examples) =>
      `&#8232; is a line break inside a paragraph (Shift+Enter in Figma, <br> in HTML), not spaces (${listed(examples)}).`,
  },
  overflow: {
    find: overflowing,
    say: (examples) =>
      examples.length === 1
        ? `A layer is wider or taller than the room its auto layout parent gives it, so it overflows the parent in Figma too (${listed(examples)}): decide whether the build wraps, clips or lets it out.`
        : `${examples.length} layers are wider or taller than the room their auto layout parent gives them, so they overflow it in Figma too (${listed(examples)}): decide whether the build wraps, clips or lets them out.`,
  },
};

/** One hint per kind, however many layers it is about. */
export function layerHints(layers: readonly ShownLayer[], root: SnapshotNode): string[] {
  const found = new Map<LayerHint, string[]>();

  for (const { node, parent } of layers) {
    const scope: LayerScope = {
      node,
      parent,
      root,
      children: visibleChildren(node),
    };

    for (const hint of Object.values(LAYER_HINTS)) {
      const example = hint.find(scope);

      if (example !== null) {
        found.set(hint, [...(found.get(hint) ?? []), example]);
      }
    }
  }

  return [...found].map(([hint, examples]) => hint.say(examples));
}

/** Layers left with the names Figma gave them. */
export function defaultNameHints(nodes: readonly SnapshotNode[]): string[] {
  const unnamed = nodes.filter((node) => DEFAULT_NAME.test(node.name));

  if (unnamed.length === 0) {
    return [];
  }

  const examples = unnamed.slice(0, EXAMPLES).map(labelOf).join(", ");

  if (unnamed.length === 1) {
    return [`1 layer keeps Figma's default name (${examples}): name it by its role in the code.`];
  }

  return [
    `${unnamed.length} layers keep Figma's default names (${examples}${unnamed.length > EXAMPLES ? ", …" : ""}): name the elements by their role in the code.`,
  ];
}

/** Texts whose fonts this machine lacks: Figma laid them out with something else. */
export function missingFontHints(nodes: readonly SnapshotNode[]): string[] {
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
      .map(labelOf)
      .join(", ")}: Figma could not lay these texts out, so their sizes may be off.`,
  ];
}

/** A frame, component or instance placing two children or more by hand, with Figma's guess at its flow. */
function placedByHand({ node, children }: LayerScope): string | null {
  const container = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";

  if (!container || node.layoutMode !== undefined || children.length < 2) {
    return null;
  }

  const guess =
    node.inferredLayout === undefined
      ? ""
      : `, Figma reads it as ${guessedLayoutCss(node.inferredLayout, children.length)}`;

  return `${labelOf(node)} with ${children.length} children${guess}`;
}

/** A layer in a flow wider, or else taller, than the room its parent gives it; a turned one's box is not its size. */
function overflowing({ node, parent }: LayerScope): string | null {
  const room = parent === null ? null : roomIn(parent);

  if (room === null || node.layoutPositioning === "ABSOLUTE" || Math.abs(node.rotation ?? 0) >= 0.5) {
    return null;
  }

  if (node.width > room.width + 0.5) {
    return `${labelOf(node)} ${px(node.width)} wide in ${px(room.width)}`;
  }

  return node.height > room.height + 0.5 ? `${labelOf(node)} ${px(node.height)} tall in ${px(room.height)}` : null;
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
