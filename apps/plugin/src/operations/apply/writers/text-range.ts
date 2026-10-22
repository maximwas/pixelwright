import type { FigmaProps } from "@pixelwright/core";
import { refusal, type TextLayer, type TypedLayer } from "../../../figma/capabilities.ts";
import type { WriteError } from "../../../figma/write-error.ts";

/**
 * A text's characters from start to end. An empty range is an empty text, which Figma writes on the node itself: it
 * refuses a range of no characters. A text on a path has a text's look but no line height or decoration.
 */
export class TextRange {
  readonly node: TextLayer;
  readonly start: number;
  readonly end: number;

  constructor(node: TextLayer, start: number, end: number) {
    this.node = node;
    this.start = start;
    this.end = end;
  }

  get #whole(): boolean {
    return this.start === this.end;
  }

  async textStyle(id: string): Promise<void> {
    await (this.#whole
      ? this.node.setTextStyleIdAsync(id)
      : this.node.setRangeTextStyleIdAsync(this.start, this.end, id));
  }

  /** The font and its size, and on a text its line height (a text on a path runs along its path, with no lines). */
  font(font: FontName, size: number, lineHeight: LineHeight): void {
    if (this.#whole) {
      this.node.fontName = font;
      this.node.fontSize = size;
    } else {
      this.node.setRangeFontName(this.start, this.end, font);
      this.node.setRangeFontSize(this.start, this.end, size);
    }

    if (this.node.type === "TEXT" && this.#whole) {
      this.node.lineHeight = lineHeight;
    } else if (this.node.type === "TEXT") {
      this.node.setRangeLineHeight(this.start, this.end, lineHeight);
    }
  }

  letterSpacing(value: LetterSpacing): void {
    if (this.#whole) {
      this.node.letterSpacing = value;
    } else {
      this.node.setRangeLetterSpacing(this.start, this.end, value);
    }
  }

  textCase(value: TextCase): void {
    if (this.#whole) {
      this.node.textCase = value;
    } else {
      this.node.setRangeTextCase(this.start, this.end, value);
    }
  }

  async fillStyle(id: string): Promise<void> {
    await (this.#whole
      ? this.node.setFillStyleIdAsync(id)
      : this.node.setRangeFillStyleIdAsync(this.start, this.end, id));
  }

  fills(paints: Paint[]): void {
    if (this.#whole) {
      this.node.fills = paints;
    } else {
      this.node.setRangeFills(this.start, this.end, paints);
    }
  }

  hyperlink(link: HyperlinkTarget | null): void {
    if (this.#whole) {
      this.node.hyperlink = link;
    } else {
      this.node.setRangeHyperlink(this.start, this.end, link);
    }
  }

  decorationLine(value: TextDecoration): void {
    const node = decorated(this.node);

    if (this.#whole) {
      node.textDecoration = value;
    } else {
      node.setRangeTextDecoration(this.start, this.end, value);
    }
  }

  /** The decoration's look: its style, colour, offset and thickness, in that order. */
  decorationLook(look: DecorationLook): void {
    const node = decorated(this.node);

    if (this.#whole) {
      node.textDecorationStyle = look.style;
      node.textDecorationColor = look.color;
      node.textDecorationOffset = look.offset;
      node.textDecorationThickness = look.thickness;
    } else {
      node.setRangeTextDecorationStyle(this.start, this.end, look.style);
      node.setRangeTextDecorationColor(this.start, this.end, look.color);
      node.setRangeTextDecorationOffset(this.start, this.end, look.offset);
      node.setRangeTextDecorationThickness(this.start, this.end, look.thickness);
    }
  }
}

/** What only one kind of text layer has, and what a refusal calls it: a text on a path has fewer of a text's. */
const OWN_KEYS: Readonly<Partial<Record<keyof FigmaProps, readonly [TextLayer["type"], string]>>> = {
  textDecoration: ["TEXT", "underline or strike-through"],
  textWrapStyle: ["TEXT", "text wrapping"],
  truncate: ["TEXT", "truncation"],
  pathStart: ["TEXT_PATH", "path for its text to start on"],
};

/** Whether this text layer lacks a property only the other kind of text layer has. */
export function lacksTextKey(layer: TypedLayer, key: keyof FigmaProps): boolean {
  const kind = OWN_KEYS[key]?.[0];

  return kind !== undefined && kind !== layer.type;
}

/** The refusal of a property this text layer lacks. */
export function textKeyRefusal(layer: TypedLayer, key: keyof FigmaProps): WriteError {
  return refusal(layer, OWN_KEYS[key]?.[1] ?? key);
}

/** A text that can be underlined or struck through: a text on a path cannot. */
function decorated(node: TextLayer): TextNode {
  if (node.type !== "TEXT") {
    throw textKeyRefusal(node, "textDecoration");
  }

  return node;
}

/** How an underline or a strike-through looks. */
export interface DecorationLook {
  readonly style: TextDecorationStyle;
  readonly color: TextDecorationColor;
  readonly offset: TextDecorationOffset;
  readonly thickness: TextDecorationThickness;
}
