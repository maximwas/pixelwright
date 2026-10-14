/**
 * A text's characters from start to end. An empty range is an empty text, which Figma writes on the node itself: it
 * refuses a range of no characters.
 */
export class TextRange {
  readonly node: TextNode;
  readonly start: number;
  readonly end: number;

  constructor(node: TextNode, start: number, end: number) {
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

  font(font: FontName, size: number, lineHeight: LineHeight): void {
    if (this.#whole) {
      this.node.fontName = font;
      this.node.fontSize = size;
      this.node.lineHeight = lineHeight;
    } else {
      this.node.setRangeFontName(this.start, this.end, font);
      this.node.setRangeFontSize(this.start, this.end, size);
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
    if (this.#whole) {
      this.node.textDecoration = value;
    } else {
      this.node.setRangeTextDecoration(this.start, this.end, value);
    }
  }

  /** The decoration's look: its style, colour, offset and thickness, in that order. */
  decorationLook(look: DecorationLook): void {
    if (this.#whole) {
      this.node.textDecorationStyle = look.style;
      this.node.textDecorationColor = look.color;
      this.node.textDecorationOffset = look.offset;
      this.node.textDecorationThickness = look.thickness;
    } else {
      this.node.setRangeTextDecorationStyle(this.start, this.end, look.style);
      this.node.setRangeTextDecorationColor(this.start, this.end, look.color);
      this.node.setRangeTextDecorationOffset(this.start, this.end, look.offset);
      this.node.setRangeTextDecorationThickness(this.start, this.end, look.thickness);
    }
  }
}

/** How an underline or a strike-through looks. */
export interface DecorationLook {
  readonly style: TextDecorationStyle;
  readonly color: TextDecorationColor;
  readonly offset: TextDecorationOffset;
  readonly thickness: TextDecorationThickness;
}
