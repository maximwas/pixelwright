import { QuoteType, Tokenizer, type TokenizerCallbacks } from "htmlparser2";
import { LineIndex } from "@/core/xml/parse/line-index.ts";
import { XML_NODE_KIND, XML_PARSE, XML_PARSE_TEXT } from "@/core/xml/parse/parse.constants.ts";
import type { XmlLocation, XmlNode } from "@/core/xml/parse/parse.types.ts";
import { XmlSyntaxError } from "@/core/xml/parse/xml-syntax-error.ts";
import { XmlText } from "@/core/xml/parse/xml-text.ts";

interface OpenElement {
  readonly type: string;
  readonly at: XmlLocation;
  readonly attributes: Map<string, string>;
  readonly children: XmlNode[];
}

interface OpenAttribute {
  readonly name: string;
  readonly at: XmlLocation;
  readonly nameEnd: number;
  raw: string;
}

/**
 * One parse: htmlparser2's tokenizer says where each piece starts and ends and forgives everything; this reader
 * is the strict half, and fails at the first fault with its place. Built per source, read once.
 */
export class XmlReader implements TokenizerCallbacks {
  readonly #source: string;
  readonly #lines: LineIndex;
  readonly #text = new XmlText();
  readonly #root: XmlNode[] = [];
  readonly #stack: OpenElement[] = [];
  /** The tag whose attributes are being read, and the attribute in it. */
  #tag: OpenElement | null = null;
  #attribute: OpenAttribute | null = null;
  /** The text read so far, as a range of the source: the tokenizer may cut one text in several. */
  #pending: { start: number; end: number } | null = null;

  constructor(source: string) {
    this.#source = source;
    this.#lines = new LineIndex(source);
  }

  read(): readonly XmlNode[] {
    const tokenizer = new Tokenizer(XML_PARSE.tokenizer, this);

    tokenizer.write(this.#source);
    tokenizer.end();

    return this.#root;
  }

  onopentagname(start: number, end: number): void {
    this.#flushText();

    const type = this.#source.slice(start, end);

    if (!XML_PARSE.name.test(type)) {
      throw this.#fail(start, XML_PARSE_TEXT.expectedTagName);
    }

    this.#tag = { type, at: this.#lines.locate(start - XML_PARSE.openChars), attributes: new Map(), children: [] };
    this.#stack.push(this.#tag);
  }

  onattribname(start: number, end: number): void {
    const name = this.#source.slice(start, end);

    if (!XML_PARSE.name.test(name)) {
      throw this.#fail(start, XML_PARSE_TEXT.expectedAttribute);
    }

    if (this.#tag?.attributes.has(name)) {
      throw this.#fail(start, XML_PARSE_TEXT.duplicate(name));
    }

    this.#attribute = { name, at: this.#lines.locate(start), nameEnd: end, raw: "" };
  }

  onattribdata(start: number, end: number): void {
    if (this.#attribute !== null) {
      this.#attribute.raw += this.#source.slice(start, end);
    }
  }

  onattribend(quote: QuoteType): void {
    const attribute = this.#attribute;

    this.#attribute = null;

    if (attribute === null) {
      return;
    }

    if (quote === QuoteType.NoValue || quote === QuoteType.Unquoted) {
      throw new XmlSyntaxError(attribute.at, XML_PARSE_TEXT.needsQuotes(attribute.name));
    }

    if (attribute.raw.includes(XML_PARSE.chars.lt)) {
      const mark = quote === QuoteType.Single ? XML_PARSE.chars.single : XML_PARSE.chars.double;

      throw new XmlSyntaxError(attribute.at, XML_PARSE_TEXT.badValue(attribute.name, mark));
    }

    this.#tag?.attributes.set(attribute.name, this.#text.decode(attribute.raw, attribute.at));
  }

  onopentagend(): void {
    this.#tag = null;
  }

  onselfclosingtag(): void {
    this.#tag = null;
    this.#finish();
  }

  onclosetag(start: number, end: number): void {
    this.#flushText();

    const found = this.#source.slice(start, end);
    const at = this.#lines.locate(this.#source.lastIndexOf(XML_PARSE.chars.closeOpen, start));
    const open = this.#stack.at(-1);

    if (open === undefined) {
      throw new XmlSyntaxError(at, XML_PARSE_TEXT.closesNothing(found));
    }

    if (open.type !== found) {
      throw new XmlSyntaxError(at, XML_PARSE_TEXT.wrongClose(open.type, open.at.line, found));
    }

    this.#finish();
  }

  ontext(start: number, end: number): void {
    if (this.#pending?.end === start) {
      this.#pending.end = end;
    } else {
      this.#flushText();
      this.#pending = { start, end };
    }
  }

  /** CDATA is text exactly as written: no entities, no trimming. `closing` is how much of `]]>` the tokenizer saw. */
  oncdata(
    start: number,
    end: number,
    closing: number,
  ): void {
    this.#flushText();

    const at = this.#lines.locate(start - XML_PARSE.cdataOpenChars);

    if (closing === 0) {
      throw new XmlSyntaxError(at, XML_PARSE_TEXT.cdataNotClosed);
    }

    this.#siblings().push({ kind: XML_NODE_KIND.text, value: this.#source.slice(start, end - closing), ...at });
  }

  /** Comments and processing instructions are nothing; a comment never closed is a fault. */
  oncomment(
    start: number,
    _end: number,
    closing: number,
  ): void {
    this.#flushText();

    if (closing === 0) {
      throw this.#fail(start - XML_PARSE.commentOpenChars, XML_PARSE_TEXT.commentNotClosed);
    }
  }

  onprocessinginstruction(): void {
    this.#flushText();
  }

  ondeclaration(start: number): void {
    throw this.#fail(start - XML_PARSE.declarationChars, XML_PARSE_TEXT.expectedTagName);
  }

  onend(): void {
    this.#flushText();

    const attribute = this.#attribute;

    if (attribute !== null) {
      const mark = this.#source.slice(attribute.nameEnd).match(XML_PARSE.quotes)?.[0] ?? XML_PARSE.chars.double;

      throw new XmlSyntaxError(attribute.at, XML_PARSE_TEXT.badValue(attribute.name, mark));
    }

    if (this.#tag !== null) {
      throw new XmlSyntaxError(this.#tag.at, XML_PARSE_TEXT.tagNotEnded(this.#tag.type));
    }

    const open = this.#stack.at(-1);

    if (open !== undefined) {
      throw new XmlSyntaxError(open.at, XML_PARSE_TEXT.notClosed(open.type));
    }
  }

  // Entities stay raw (decodeEntities is off): XmlText decodes them with its errors.
  onattribentity(): void {}

  ontextentity(): void {}

  #fail(index: number, reason: string): XmlSyntaxError {
    return new XmlSyntaxError(this.#lines.locate(index), reason);
  }

  #siblings(): XmlNode[] {
    return this.#stack.at(-1)?.children ?? this.#root;
  }

  /** The open element is whole: it joins its parent. */
  #finish(): void {
    const element = this.#stack.pop();

    if (element !== undefined) {
      this.#siblings().push({
        kind: XML_NODE_KIND.element,
        type: element.type,
        props: Object.fromEntries(element.attributes),
        children: element.children,
        ...element.at,
      });
    }
  }

  #flushText(): void {
    const pending = this.#pending;

    this.#pending = null;

    if (pending === null) {
      return;
    }

    const raw = this.#source.slice(pending.start, pending.end);
    const stray = raw.indexOf(XML_PARSE.chars.lt);

    if (stray !== -1) {
      throw this.#fail(pending.start + stray, XML_PARSE_TEXT.expectedTagName);
    }

    // A text is where its first character that is not a space is (a line break before it is the markup's); a text of
    // spaces alone, where it starts.
    const lead = XML_PARSE.space.exec(raw)?.[0].length ?? 0;
    const at = this.#lines.locate(lead === raw.length ? pending.start : pending.start + lead);
    const value = this.#text.decode(this.#text.clean(raw), at);

    if (value !== "") {
      this.#siblings().push({ kind: XML_NODE_KIND.text, value, ...at });
    }
  }
}
