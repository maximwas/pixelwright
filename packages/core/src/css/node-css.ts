import { withoutFallbacks } from "../apply/css-values.ts";
import { CSS_ORDER, VECTOR_TYPES } from "../constants/css.ts";
import { MIXED } from "../schemas/snapshot.ts";
import type { CssContext, NodeCss } from "../types/css.ts";
import type { SnapshotEffect, SnapshotNode, TextSegment } from "../types/snapshot.ts";
import { colorCss } from "./color.ts";
import { boxShorthand, decimal, px } from "./format.ts";
import { boundVariable, paintsCss, UNMAPPED } from "./paint.ts";
import { baseSegment, segmentCss, textAlignCss } from "./text.ts";
import { styleTokenName, variableTokenName } from "./tokens.ts";

const JUSTIFY: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
  SPACE_EVENLY: "space-evenly",
  SPACE_AROUND: "space-around",
};

/** Ways of spreading children that leave no room for a gap. */
const SPREAD = new Set(["SPACE_BETWEEN", "SPACE_EVENLY", "SPACE_AROUND"]);

const SELF_ALIGN: Readonly<Record<string, string>> = {
  MIN: "start",
  CENTER: "center",
  MAX: "end",
};

/** A size the constraints decide instead of the layer's own: left out (stretched) or a percent (scaled). */
type SizeOverride = Partial<Record<"width" | "height", string | null>>;

const ALIGN: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  BASELINE: "baseline",
};

const RADII = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;
const SIDES = [
  ["strokeTopWeight", "border-top"],
  ["strokeRightWeight", "border-right"],
  ["strokeBottomWeight", "border-bottom"],
  ["strokeLeftWeight", "border-left"],
] as const;

/**
 * A layer's CSS from its raw Figma properties, through the one mapping table design_apply reads back. `parent` decides
 * how the layer sits (flowing in auto layout, or placed absolutely); the read's root always gets its size.
 */
export function nodeCss(node: SnapshotNode, parent: SnapshotNode | null, context: CssContext): NodeCss {
  const css = new Map<string, string>();
  const readOnly: [string, string][] = [];
  let textStyle: string | undefined;

  layoutCss(node, css, readOnly, context);

  if (node.type === "LINE") {
    lineCss(node, parent, css, context);
    centredStroke(node, readOnly);
  } else {
    sizeCss(node, parent, context, css, positionCss(node, parent, context, css));
    gridChildCss(node, parent, css);
  }

  if (node.opacity !== undefined) {
    css.set("opacity", decimal(node.opacity));
  }

  if (node.clipsContent) {
    css.set("overflow", "hidden");
  }

  if (node.isMask) {
    // A mask among other layers clips the ones above it; a mask group as a whole is exported as one image.
    readOnly.push(["mask", "clips the layers above it"]);
  }

  if (node.blendMode !== undefined) {
    readOnly.push([
      "mix-blend-mode",
      node.css?.["mix-blend-mode"] ?? node.blendMode.toLowerCase().replaceAll("_", "-"),
    ]);
  }

  if (node.type === "TEXT") {
    textStyle = textCss(node, css, readOnly, context);
  } else if (!VECTOR_TYPES.has(node.type) && node.type !== "LINE") {
    radiusCss(node, css, context);
    borderCss(node, css, readOnly, context);

    const background = paintsCss(node.fills, styleIdOf(node.fillStyleId), node, context);

    if (background === UNMAPPED) {
      readOnly.push(["background", node.css?.background ?? "a gradient or other fill the table cannot write yet"]);
    } else if (background !== null) {
      css.set("background", background);
    }
  }

  effectsCss(node, css, readOnly, context);

  return {
    properties: [...css].sort(([a], [b]) => order(a) - order(b)),
    readOnly: readOnly.map(([property, value]) => [property, cleanOracle(value)]),
    ...(textStyle === undefined ? {} : { textStyle }),
  };
}

function order(property: string): number {
  const index = (CSS_ORDER as readonly string[]).indexOf(property);

  return index === -1 ? CSS_ORDER.length : index;
}

function isFlex(node: SnapshotNode | null): boolean {
  return node?.layoutMode === "HORIZONTAL" || node?.layoutMode === "VERTICAL";
}

function hasLayout(node: SnapshotNode | null): boolean {
  return isFlex(node) || node?.layoutMode === "GRID";
}

function layoutCss(
  node: SnapshotNode,
  css: Map<string, string>,
  readOnly: [string, string][],
  context: CssContext,
): void {
  if (node.layoutMode === "GRID") {
    css.set("display", "grid");

    const columns =
      tracksCss(node.gridColumnSizes) ??
      (node.gridColumnCount === undefined ? null : `repeat(${node.gridColumnCount}, 1fr)`);
    const rows = tracksCss(node.gridRowSizes);

    if (columns !== null) {
      css.set("grid-template-columns", columns);
    }

    if (rows !== null) {
      css.set("grid-template-rows", rows);
    }

    setLength(css, "column-gap", node, "gridColumnGap", node.gridColumnGap, context);
    setLength(css, "row-gap", node, "gridRowGap", node.gridRowGap, context);

    return;
  }

  if (!isFlex(node)) {
    return;
  }

  css.set("display", "flex");

  if (node.layoutMode === "VERTICAL") {
    css.set("flex-direction", "column");
  }

  if (node.layoutWrap === "WRAP") {
    css.set("flex-wrap", "wrap");
  }

  const sides = (["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map((key) =>
    length(node, key, node[key] ?? 0, context),
  );

  if (sides.some((side) => side !== "0")) {
    css.set("padding", boxShorthand(...(sides as [string, string, string, string])));
  }

  const justify = JUSTIFY[node.primaryAxisAlignItems ?? "MIN"];
  const align = ALIGN[node.counterAxisAlignItems ?? "MIN"];

  if (justify !== undefined) {
    css.set("justify-content", justify);
  }

  if (align !== undefined) {
    css.set("align-items", align);
  }

  const spaced = node.children?.filter((child) => child.visible).length ?? node.childCount;

  // Spreading spaces the children itself, and a gap with fewer than two children spaces nothing.
  if (!SPREAD.has(node.primaryAxisAlignItems ?? "MIN") && spaced >= 2) {
    if ((node.itemSpacing ?? 0) < 0) {
      // Figma lets children overlap by a negative spacing (avatar stacks); CSS gap cannot be negative.
      readOnly.push(["gap", `${px(node.itemSpacing ?? 0)} (the children overlap)`]);
    } else {
      setLength(css, "gap", node, "itemSpacing", node.itemSpacing, context);
    }
  }

  if (node.layoutWrap === "WRAP") {
    // Between wrapped lines: rows of a horizontal wrap, columns of a vertical one. CSS's gap spaces the lines too, so
    // the line gap is written only when it differs from the gap written, 0 included.
    const between = node.layoutMode === "VERTICAL" ? "column-gap" : "row-gap";
    const lines =
      typeof node.counterAxisSpacing === "number"
        ? length(node, "counterAxisSpacing", node.counterAxisSpacing, context)
        : undefined;

    if (lines !== undefined && lines !== (css.get("gap") ?? "0")) {
      css.set(between, lines);
    }

    if (node.counterAxisAlignContent === "SPACE_BETWEEN") {
      css.set("align-content", "space-between");
    }
  }
}

/** Grid tracks: a flex track is `fr`, a fixed one pixels, a hugging one `auto`; equal tracks as repeat(). */
function tracksCss(tracks: SnapshotNode["gridColumnSizes"]): string | null {
  if (tracks === undefined || tracks.length === 0) {
    return null;
  }

  const sizes = tracks.map((track) =>
    track.type === "FIXED" ? px(track.value ?? 0) : track.type === "HUG" ? "auto" : `${decimal(track.value ?? 1)}fr`,
  );
  const [first] = sizes;

  return sizes.length > 2 && sizes.every((size) => size === first)
    ? `repeat(${sizes.length}, ${first})`
    : sizes.join(" ");
}

/** Where a grid's child sits (1-based lines in CSS) and how it aligns in its cell. */
function gridChildCss(node: SnapshotNode, parent: SnapshotNode | null, css: Map<string, string>): void {
  if (parent?.layoutMode !== "GRID" || node.layoutPositioning === "ABSOLUTE") {
    return;
  }

  const place = (anchor: number | undefined, span: number | undefined) =>
    anchor === undefined ? undefined : (span ?? 1) > 1 ? `${anchor + 1} / span ${span}` : String(anchor + 1);
  const row = place(node.gridRowAnchorIndex, node.gridRowSpan);
  const column = place(node.gridColumnAnchorIndex, node.gridColumnSpan);
  const justify = SELF_ALIGN[node.gridChildHorizontalAlign ?? "AUTO"];
  const align = SELF_ALIGN[node.gridChildVerticalAlign ?? "AUTO"];

  for (const [property, value] of [
    ["grid-row", row],
    ["grid-column", column],
    ["justify-self", justify],
    ["align-self", align],
  ] as const) {
    if (value !== undefined) {
      css.set(property, value);
    }
  }
}

function sizeCss(
  node: SnapshotNode,
  parent: SnapshotNode | null,
  context: CssContext,
  css: Map<string, string>,
  override: SizeOverride,
): void {
  const isRoot = node === context.root;
  const flowing = isFlex(parent) && node.layoutPositioning !== "ABSOLUTE";
  const axes = [
    ["width", node.layoutSizingHorizontal, node.width, parent?.layoutMode === "HORIZONTAL"],
    ["height", node.layoutSizingVertical, node.height, parent?.layoutMode === "VERTICAL"],
  ] as const;

  for (const [property, sizing, value, mainAxis] of axes) {
    const decided = override[property];

    if (decided !== undefined) {
      if (decided !== null) {
        css.set(property, decided);
      }
    } else if (isRoot || sizing === "FIXED" || sizing === undefined) {
      setLength(css, property, node, property, value, context);
    } else if (sizing === "FILL" && flowing) {
      css.set(mainAxis ? "flex" : "align-self", mainAxis ? "1" : "stretch");
    }
  }

  for (const key of ["minWidth", "maxWidth", "minHeight", "maxHeight"] as const) {
    setLength(
      css,
      key.replace(/[A-Z]/, (letter) => `-${letter.toLowerCase()}`),
      node,
      key,
      node[key],
      context,
    );
  }
}

function positionCss(
  node: SnapshotNode,
  parent: SnapshotNode | null,
  context: CssContext,
  css: Map<string, string>,
): SizeOverride {
  const transform = transformCss(node);
  const override: SizeOverride = {};

  if (transform !== null) {
    css.set("transform", transform);
  }

  if (parent === null || node === context.root || !(node.layoutPositioning === "ABSOLUTE" || !hasLayout(parent))) {
    return override;
  }

  // A rotated or mirrored layer turns about its centre in CSS: place the unrotated box so the centres meet (Figma's
  // own x and y are the transformed corner, the far one at -180).
  const centre =
    node.bounds !== undefined
      ? {
          x: node.bounds.x + node.bounds.width / 2,
          y: node.bounds.y + node.bounds.height / 2,
        }
      : null;
  const left = (centre === null ? node.x : centre.x - node.width / 2) - parent.x;
  const top = (centre === null ? node.y : centre.y - node.height / 2) - parent.y;
  // A group is no frame: its layers keep their place in it whatever their constraints say.
  const constraints = parent.type === "GROUP" ? undefined : node.constraints;

  css.set("position", "absolute");
  pin(css, override, constraints?.horizontal ?? "MIN", ["left", "right", "width"], left, node.width, parent.width);
  pin(css, override, constraints?.vertical ?? "MIN", ["top", "bottom", "height"], top, node.height, parent.height);

  return override;
}

/**
 * One axis of an absolutely placed layer from its constraint: pinned to the start (MIN) or the end (MAX), held at its
 * offset from the centre, stretched between both edges, or scaled as percents of the parent.
 */
function pin(
  css: Map<string, string>,
  override: SizeOverride,
  constraint: string,
  [start, end, size]: readonly ["left" | "top", "right" | "bottom", "width" | "height"],
  offset: number,
  length: number,
  parentLength: number,
): void {
  const toEnd = parentLength - offset - length;

  if (constraint === "MAX") {
    css.set(end, px(toEnd));
  } else if (constraint === "CENTER") {
    const fromCentre = Math.round(offset - parentLength / 2);

    css.set(start, fromCentre === 0 ? "50%" : `calc(50% ${fromCentre < 0 ? "-" : "+"} ${Math.abs(fromCentre)}px)`);
  } else if (constraint === "STRETCH") {
    css.set(start, px(offset));
    css.set(end, px(toEnd));
    override[size] = null;
  } else if (constraint === "SCALE" && parentLength > 0) {
    css.set(start, `${decimal((offset / parentLength) * 100)}%`);
    override[size] = `${decimal((length / parentLength) * 100)}%`;
  } else {
    css.set(start, px(offset));
  }
}

/**
 * CSS turns clockwise, Figma counter-clockwise. A mirrored layer is its matrix times a horizontal flip: the angle left
 * once the flip is taken out, then scaleX(-1).
 */
function transformCss(node: SnapshotNode): string | null {
  if (node.mirrorTransform !== undefined) {
    const [a = -1, b = 0] = node.mirrorTransform;
    const angle = Math.round(((Math.atan2(b, -a) * 180) / Math.PI) * 100) / 100;

    return angle === 0 ? "scaleX(-1)" : `rotate(${decimal(-angle)}deg) scaleX(-1)`;
  }

  const rotation = node.rotation ?? 0;

  return rotation === 0 ? null : `rotate(${decimal(-rotation)}deg)`;
}

/**
 * A line is a box with one border: across when it lies flat, down its left side when it stands (within half a degree
 * of a right angle); any other angle is a flat line turned about its centre.
 */
function lineCss(node: SnapshotNode, parent: SnapshotNode | null, css: Map<string, string>, context: CssContext): void {
  const angle = (((node.rotation ?? 0) % 180) + 180) % 180;
  const standing = Math.abs(angle - 90) <= 0.5;
  const flat = angle <= 0.5 || angle >= 179.5;
  const color = paintsCss(node.strokes, node.strokeStyleId, node, context);
  const weight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
  const border = `${px(weight)} ${node.dashPattern === undefined ? "solid" : "dashed"} ${typeof color === "string" ? color : "currentColor"}`;

  if (!standing && !flat) {
    positionCss(node, parent, context, css);
    css.set("width", px(node.width));
    css.set("border-top", border);

    return;
  }

  if (parent !== null && node !== context.root && (node.layoutPositioning === "ABSOLUTE" || !hasLayout(parent))) {
    const box = node.bounds ?? node;

    css.set("position", "absolute");
    css.set("left", px(box.x - parent.x));
    css.set("top", px(box.y - parent.y));
  }

  if (standing) {
    css.set("height", px(node.width));
    css.set("border-left", border);
  } else {
    css.set("width", px(node.width));
    css.set("border-top", border);
  }
}

function radiusCss(node: SnapshotNode, css: Map<string, string>, context: CssContext): void {
  if (node.type === "ELLIPSE") {
    css.set("border-radius", "50%");

    return;
  }

  if (node.cornerRadius === MIXED) {
    css.set("border-radius", RADII.map((key) => length(node, key, node[key] ?? 0, context)).join(" "));
  } else if (node.cornerRadius !== undefined) {
    setLength(css, "border-radius", node, "topLeftRadius", node.cornerRadius, context);
  }
}

function borderCss(
  node: SnapshotNode,
  css: Map<string, string>,
  readOnly: [string, string][],
  context: CssContext,
): void {
  const color = paintsCss(node.strokes, node.strokeStyleId, node, context);

  if (color === null) {
    return;
  }

  if (color === UNMAPPED) {
    readOnly.push(["border", node.css?.border ?? "a gradient or other stroke the table cannot write yet"]);

    return;
  }

  const line = (weight: number) => `${px(weight)} ${node.dashPattern === undefined ? "solid" : "dashed"} ${color}`;

  if (node.strokeWeight === MIXED) {
    for (const [key, property] of SIDES) {
      const weight = node[key] ?? 0;

      if (weight > 0) {
        css.set(property, line(weight));
      }
    }

    centredStroke(node, readOnly);

    return;
  }

  // An inside or centred stroke is a border (with box-sizing: border-box it keeps the size); outside, an outline.
  css.set(node.strokeAlign === "OUTSIDE" ? "outline" : "border", line(node.strokeWeight ?? 1));
  centredStroke(node, readOnly);
}

/** A centred stroke paints half of itself outside the layer's box, which a border-box border cannot. */
function centredStroke(node: SnapshotNode, readOnly: [string, string][]): void {
  if (node.strokeAlign === "CENTER") {
    readOnly.push(["stroke-align", "center (half of it paints outside the box)"]);
  }
}

function effectsCss(
  node: SnapshotNode,
  css: Map<string, string>,
  readOnly: [string, string][],
  context: CssContext,
): void {
  const effects = (node.effects ?? []).filter((effect) => effect.visible !== false);
  const style = node.effectStyleId === undefined ? undefined : context.styles[node.effectStyleId];
  const isText = node.type === "TEXT";
  const shadows = effects
    .filter((effect) => effect.type === "DROP_SHADOW" || (effect.type === "INNER_SHADOW" && !isText))
    .toReversed()
    .map((effect) => shadowCss(effect, isText))
    .join(", ");

  if (shadows !== "") {
    const property = isText ? "text-shadow" : "box-shadow";

    if (style !== undefined) {
      const name = styleTokenName(style);

      context.tokens.set(name, shadows);
      css.set(property, `var(${name})`);
    } else {
      css.set(property, shadows);
    }
  }

  // Figma's blur radius is twice the CSS one: Dev Mode writes blur(radius / 2). A progressive blur shows its end
  // radius, and how it runs is noted: CSS has no blur that changes across a box.
  for (const effect of effects) {
    if (effect.type === "LAYER_BLUR" && effect.radius !== undefined) {
      css.set("filter", `blur(${px(effect.radius / 2)})`);
      progressiveBlur(effect, "blur", readOnly);
    }

    if (effect.type === "BACKGROUND_BLUR" && effect.radius !== undefined) {
      css.set("backdrop-filter", `blur(${px(effect.radius / 2)})`);
      progressiveBlur(effect, "backdrop-blur", readOnly);
    }
  }
}

/** A progressive blur's run, in CSS radii, from where it starts to where it ends (percents of the box). */
function progressiveBlur(effect: SnapshotEffect, property: string, readOnly: [string, string][]): void {
  if (effect.blurType !== "PROGRESSIVE") {
    return;
  }

  const at = (offset: { x: number; y: number } | undefined, fallback: { x: number; y: number }) => {
    const { x, y } = offset ?? fallback;

    return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
  };
  const radius = (value: number) => `${Math.round(value / 2)}px`;

  readOnly.push([
    property,
    `progressive from ${radius(effect.startRadius ?? 0)} at ${at(effect.startOffset, {
      x: 0.5,
      y: 0,
    })} to ${radius(effect.radius ?? 0)} at ${at(effect.endOffset, {
      x: 0.5,
      y: 1,
    })}`,
  ]);
}

/** Shadows as a box-shadow list, top first (an effect style's value, for the tokens). */
export function shadowListCss(effects: readonly SnapshotEffect[]): string {
  return effects
    .filter((effect) => effect.visible !== false && (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW"))
    .toReversed()
    .map((effect) => shadowCss(effect, false))
    .join(", ");
}

function shadowCss(effect: SnapshotEffect, isText: boolean): string {
  const parts = [
    effect.type === "INNER_SHADOW" ? "inset" : null,
    px(effect.offset?.x ?? 0),
    px(effect.offset?.y ?? 0),
    px(effect.radius ?? 0),
    isText ? null : px(effect.spread ?? 0),
    effect.color === undefined ? null : colorCss(effect.color),
  ];

  return parts.filter((part) => part !== null).join(" ");
}

function textCss(
  node: SnapshotNode,
  css: Map<string, string>,
  readOnly: [string, string][],
  context: CssContext,
): string | undefined {
  const base = node.text === undefined ? undefined : baseSegment(node.text.segments);
  const align = textAlignCss(node);

  if (align !== undefined) {
    css.set("text-align", align);
  }

  if (base === undefined) {
    return undefined;
  }

  const { css: run, textStyle } = segmentCss(base, node, context, readOnly);

  for (const [property, value] of run) {
    css.set(property, value);
  }

  textBlockCss(node, base, css, readOnly);

  return textStyle;
}

const TEXT_WRAPS: Readonly<Record<string, string>> = {
  BALANCE: "balance",
  PRETTY: "pretty",
};

const LIST_STYLES: Readonly<Record<string, string>> = {
  ORDERED: "decimal",
  UNORDERED: "disc",
};

/** What a text box does as a whole: wrapping, truncation, vertical alignment, lists and paragraphs. */
function textBlockCss(
  node: SnapshotNode,
  base: TextSegment,
  css: Map<string, string>,
  readOnly: [string, string][],
): void {
  const text = node.text;

  if (text === undefined) {
    return;
  }

  const wrap = TEXT_WRAPS[base.textWrapStyle ?? "AUTO"];

  if (wrap !== undefined) {
    css.set("text-wrap", wrap);
  }

  if (text.textTruncation === "ENDING") {
    if ((text.maxLines ?? 1) <= 1) {
      css.set("overflow", "hidden");
      css.set("text-overflow", "ellipsis");
      css.set("white-space", "nowrap");
    } else {
      readOnly.push(["line-clamp", String(text.maxLines)]);
    }
  }

  if (
    node.layoutSizingVertical === "FIXED" &&
    (text.textAlignVertical === "CENTER" || text.textAlignVertical === "BOTTOM")
  ) {
    readOnly.push(["align-content", text.textAlignVertical === "CENTER" ? "center" : "end"]);
  }

  const list = text.segments
    .map((segment) => LIST_STYLES[segment.listOptions?.type ?? "NONE"])
    .find((style) => style !== undefined);

  if (list !== undefined) {
    readOnly.push(["list-style", list]);
  }

  if (typeof text.paragraphSpacing === "number" && text.paragraphSpacing > 0) {
    readOnly.push(["paragraph-spacing", px(text.paragraphSpacing)]);
  }

  if ((base.paragraphIndent ?? 0) > 0) {
    readOnly.push(["text-indent", px(base.paragraphIndent ?? 0)]);
  }

  if (text.leadingTrim === "CAP_HEIGHT") {
    readOnly.push(["text-box", "trim-both cap alphabetic"]);
  }

  if (text.hangingPunctuation) {
    readOnly.push(["hanging-punctuation", "first"]);
  }
}

function styleIdOf(id: string | undefined): string | undefined {
  return id === undefined || id === "" || id === MIXED ? undefined : id;
}

/** A length, or the token of the variable bound to it. */
function length(node: SnapshotNode, key: string, value: number, context: CssContext): string {
  const variable = boundVariable(node.boundVariables?.[key], context);

  if (variable === null) {
    return px(value);
  }

  const name = variableTokenName(variable);

  if (typeof variable.value === "number") {
    context.tokens.set(name, px(variable.value));
  }

  return `var(${name})`;
}

function setLength(
  css: Map<string, string>,
  property: string,
  node: SnapshotNode,
  key: string,
  value: number | undefined,
  context: CssContext,
): void {
  if (value === undefined) {
    return;
  }

  const written = length(node, key, value, context);

  if (written !== "0" || property === "width" || property === "height") {
    css.set(property, written);
  }
}

/** getCSSAsync's value made like ours: no fallbacks inside var(), no comments, whole pixels. */
export function cleanOracle(value: string): string {
  return withoutFallbacks(value)
    .replace(/(-?\d+\.\d+)px/g, (_match, number: string) => px(Number(number)))
    .trim();
}
