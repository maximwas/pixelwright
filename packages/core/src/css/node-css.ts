import { VECTOR_TYPES } from "../constants/css.ts";
import { CssDeclarations } from "../css-mapping/css-declarations.ts";
import { readAppearance, readLayoutGrids, readRadius } from "../css-mapping/groups/appearance.ts";
import { readEffects } from "../css-mapping/groups/effects.ts";
import { readGeometry } from "../css-mapping/groups/geometry/geometry.ts";
import { readLayout } from "../css-mapping/groups/layout/layout.ts";
import { readBackground } from "../css-mapping/groups/paint/fills.ts";
import { readLine } from "../css-mapping/groups/paint/line.ts";
import { readStrokes } from "../css-mapping/groups/paint/strokes.ts";
import { px } from "../css-mapping/values/format.ts";
import type { CssContext, NodeCss } from "../types/css.ts";
import type { SnapshotNode, TextSegment } from "../types/snapshot.ts";
import { baseSegment, segmentCss, textAlignCss } from "./text.ts";

/**
 * A layer's CSS from its raw Figma properties, through the one mapping table design_apply reads back. `parent` decides
 * how the layer sits (flowing in auto layout, or placed absolutely); the read's root always gets its size.
 */
export function nodeCss(node: SnapshotNode, parent: SnapshotNode | null, context: CssContext): NodeCss {
  const css = new CssDeclarations(node, context);
  const scope = {
    node,
    parent,
    context,
    css,
  };
  let textStyle: string | undefined;

  readLayout(node, css);

  if (node.type === "LINE") {
    readLine(scope);
  } else {
    readGeometry(scope);
  }

  readAppearance(node, css);

  if (node.type === "TEXT") {
    textStyle = textCss(node, css, context);
  } else if (!VECTOR_TYPES.has(node.type) && node.type !== "LINE") {
    readRadius(node, css);
    readStrokes(node, css, context);
    readBackground(node, css, context);
  }

  readEffects(node, css, context);
  readLayoutGrids(node, css);

  return css.build(textStyle);
}

function textCss(node: SnapshotNode, css: CssDeclarations, context: CssContext): string | undefined {
  const base = node.text === undefined ? undefined : baseSegment(node.text.segments);
  const align = textAlignCss(node);

  if (align !== undefined) {
    css.set("text-align", align);
  }

  if (base === undefined) {
    return undefined;
  }

  const notes: [string, string][] = [];
  const { css: run, textStyle } = segmentCss(base, node, context, notes);

  for (const [property, value] of notes) {
    css.readOnly(property, value);
  }

  for (const [property, value] of run) {
    css.set(property, value);
  }

  textBlockCss(node, base, css);

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
function textBlockCss(node: SnapshotNode, base: TextSegment, css: CssDeclarations): void {
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
      css.readOnly("line-clamp", String(text.maxLines));
    }
  }

  if (
    node.layoutSizingVertical === "FIXED" &&
    (text.textAlignVertical === "CENTER" || text.textAlignVertical === "BOTTOM")
  ) {
    css.readOnly("align-content", text.textAlignVertical === "CENTER" ? "center" : "end");
  }

  const list = text.segments
    .map((segment) => LIST_STYLES[segment.listOptions?.type ?? "NONE"])
    .find((style) => style !== undefined);

  if (list !== undefined) {
    css.readOnly("list-style", list);
  }

  if (typeof text.paragraphSpacing === "number" && text.paragraphSpacing > 0) {
    css.readOnly("paragraph-spacing", px(text.paragraphSpacing));
  }

  if ((text.listSpacing ?? 0) > 0) {
    css.readOnly("list-spacing", px(text.listSpacing ?? 0));
  }

  if ((base.paragraphIndent ?? 0) > 0) {
    css.readOnly("text-indent", px(base.paragraphIndent ?? 0));
  }

  if (text.leadingTrim === "CAP_HEIGHT") {
    css.readOnly("text-box", "trim-both cap alphabetic");
  }

  if (text.hangingPunctuation) {
    css.readOnly("hanging-punctuation", "first");
  }
}
