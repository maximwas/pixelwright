import type { CssContext } from "../../../types/css.ts";
import type { SnapshotNode, TextSegment } from "../../../types/snapshot.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import { px } from "../../values/format.ts";
import { baseSegment, segmentCss } from "./run.ts";

type Text = NonNullable<SnapshotNode["text"]>;

const ALIGN_CSS: Readonly<Record<string, string>> = {
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "justify",
};

const WRAP_CSS: Readonly<Record<string, string>> = {
  BALANCE: "balance",
  PRETTY: "pretty",
};

const LIST_STYLES: Readonly<Record<string, string>> = {
  ORDERED: "decimal",
  UNORDERED: "disc",
};

/**
 * A text layer's CSS: its alignment, its longest run as the text's own style (the other runs become spans), and what
 * the box does as a whole. Returns the text style the layer uses, whose properties it then leaves out.
 */
export function readText(node: SnapshotNode, css: CssDeclarations, context: CssContext): string | undefined {
  const base = node.text === undefined ? undefined : baseSegment(node.text.segments);
  const align = textAlignCss(node);

  if (align !== undefined) {
    css.set("text-align", align);
  }

  if (base === undefined || node.text === undefined) {
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

  readBlock(node, node.text, base, css);

  return textStyle;
}

/** The text's alignment: left is the default and is left out. */
export function textAlignCss(node: SnapshotNode): string | undefined {
  return node.text === undefined ? undefined : ALIGN_CSS[node.text.textAlignHorizontal];
}

/** What a text box does as a whole: wrapping, truncation, vertical alignment, lists and paragraphs. */
function readBlock(node: SnapshotNode, text: Text, base: TextSegment, css: CssDeclarations): void {
  const wrap = WRAP_CSS[base.textWrapStyle ?? "AUTO"];

  if (wrap !== undefined) {
    css.set("text-wrap", wrap);
  }

  readTruncation(text, css);

  if (
    node.layoutSizingVertical === "FIXED" &&
    (text.textAlignVertical === "CENTER" || text.textAlignVertical === "BOTTOM")
  ) {
    css.readOnly("align-content", text.textAlignVertical === "CENTER" ? "center" : "end");
  }

  readParagraphs(text, base, css);
}

/** A one-line truncation is CSS's ellipsis (overflow writes it back); more lines are a line clamp, read-only. */
function readTruncation(text: Text, css: CssDeclarations): void {
  if (text.textTruncation !== "ENDING") {
    return;
  }

  if ((text.maxLines ?? 1) <= 1) {
    css.set("overflow", "hidden");
    css.set("text-overflow", "ellipsis");
    css.set("white-space", "nowrap");
  } else {
    css.readOnly("line-clamp", String(text.maxLines));
  }
}

/** Lists, paragraph and list spacing, the first line's indent, leading trim and hanging punctuation, read-only. */
function readParagraphs(text: Text, base: TextSegment, css: CssDeclarations): void {
  const list = text.segments
    .map((segment) => LIST_STYLES[segment.listOptions?.type ?? "NONE"])
    .find((style) => style !== undefined);
  const notes: [string, string | null][] = [
    ["list-style", list ?? null],
    [
      "paragraph-spacing",
      typeof text.paragraphSpacing === "number" && text.paragraphSpacing > 0 ? px(text.paragraphSpacing) : null,
    ],
    ["list-spacing", (text.listSpacing ?? 0) > 0 ? px(text.listSpacing ?? 0) : null],
    ["text-indent", (base.paragraphIndent ?? 0) > 0 ? px(base.paragraphIndent ?? 0) : null],
    ["text-box", text.leadingTrim === "CAP_HEIGHT" ? "trim-both cap alphabetic" : null],
    ["hanging-punctuation", text.hangingPunctuation ? "first" : null],
  ];

  for (const [property, value] of notes) {
    if (value !== null) {
      css.readOnly(property, value);
    }
  }
}
