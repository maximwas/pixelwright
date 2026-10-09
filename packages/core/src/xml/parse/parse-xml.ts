import { XML_CDATA_CLOSE, XML_CDATA_OPEN, XML_NAME, XML_SKIPPED } from "../../constants/xml.ts";
import type { XmlChild, XmlElementNode, XmlLocation } from "../../types/xml.ts";
import { decodeEntities } from "./entities.ts";
import { cleanMarkupText } from "./whitespace.ts";
import { invalidXml } from "./xml-errors.ts";

/**
 * XML as elements and text, strictly: a tag left open, a stray closing tag or a bare `&` fails with its line and
 * column, since a guess would put nodes in the wrong place. Several top-level elements are fine. Names may hold `$`
 * (read-only attributes such as `$css`), which strict XML parsers refuse. Ported from Sitewright (MIT).
 */
export function parseXml(source: string): XmlChild[] {
  return new XmlReader(source).read();
}

class XmlReader {
  readonly #source: string;
  readonly #lineStarts: number[] = [0];
  #index = 0;

  constructor(source: string) {
    this.#source = source;

    for (let newline = source.indexOf("\n"); newline !== -1; newline = source.indexOf("\n", newline + 1)) {
      this.#lineStarts.push(newline + 1);
    }
  }

  read(): XmlChild[] {
    return this.#content(null);
  }

  /** Children up to the closing tag of `open`, or to the end of the source for the top level. */
  #content(open: XmlElementNode | null): XmlChild[] {
    const children: XmlChild[] = [];

    for (;;) {
      const start = this.#index;
      const tag = this.#source.indexOf("<", start);

      this.#index = tag === -1 ? this.#source.length : tag;
      this.#pushText(children, this.#source.slice(start, this.#index), start);

      if (tag === -1) {
        if (open !== null) {
          throw invalidXml(open, `<${open.type}> is not closed.`);
        }

        return children;
      }

      if (this.#skipMarkup()) {
        continue;
      }

      if (this.#source.startsWith(XML_CDATA_OPEN, this.#index)) {
        children.push(this.#cdata());
      } else if (this.#source.startsWith("</", this.#index)) {
        this.#closingTag(open);

        return children;
      } else {
        children.push(this.#element());
      }
    }
  }

  #pushText(children: XmlChild[], raw: string, start: number): void {
    const at = this.#locate(start);
    const value = decodeEntities(cleanMarkupText(raw), at);

    if (value !== "") {
      children.push({
        kind: "text",
        value,
        ...at,
      });
    }
  }

  /** Comments and processing instructions are nothing. */
  #skipMarkup(): boolean {
    for (const [open, close] of XML_SKIPPED) {
      if (this.#source.startsWith(open, this.#index)) {
        this.#index = this.#after(close, `${open} is not closed with ${close}.`);

        return true;
      }
    }

    return false;
  }

  /** CDATA is text exactly as written: no entities, no trimming. */
  #cdata(): XmlChild {
    const at = this.#locate(this.#index);
    const start = this.#index + XML_CDATA_OPEN.length;

    this.#index = this.#after(XML_CDATA_CLOSE, `${XML_CDATA_OPEN} is not closed with ${XML_CDATA_CLOSE}.`);

    return {
      kind: "text",
      value: this.#source.slice(start, this.#index - XML_CDATA_CLOSE.length),
      ...at,
    };
  }

  #closingTag(open: XmlElementNode | null): void {
    const at = this.#locate(this.#index);

    this.#index += 2;

    const type = this.#name("a tag name after </");

    this.#skipSpace();
    this.#expect(">");

    if (open === null) {
      throw invalidXml(at, `</${type}> closes nothing.`);
    }

    if (type !== open.type) {
      throw invalidXml(at, `Expected </${open.type}> for the tag at line ${open.line}, found </${type}>.`);
    }
  }

  #element(): XmlElementNode {
    const at = this.#locate(this.#index);

    this.#index += 1;

    const type = this.#name("a tag name after <");
    const props: Record<string, string> = {};

    for (;;) {
      this.#skipSpace();

      const selfClosing = this.#source.startsWith("/>", this.#index);

      if (selfClosing || this.#source[this.#index] === ">") {
        this.#index += selfClosing ? 2 : 1;

        const element: XmlElementNode = {
          kind: "element",
          type,
          props,
          children: [],
          ...at,
        };

        return selfClosing
          ? element
          : {
              ...element,
              children: this.#content(element),
            };
      }

      this.#attribute(props);
    }
  }

  #attribute(props: Record<string, string>): void {
    const at = this.#locate(this.#index);
    const name = this.#name("an attribute, > or />");

    if (name in props) {
      throw invalidXml(at, `Attribute ${name} is given twice.`);
    }

    this.#skipSpace();
    this.#expect("=");
    this.#skipSpace();

    const quote = this.#source[this.#index];

    if (quote !== '"' && quote !== "'") {
      throw invalidXml(this.#locate(this.#index), `The value of ${name} needs quotes: ${name}="…".`);
    }

    const start = this.#index + 1;
    const end = this.#source.indexOf(quote, start);
    const raw = end === -1 ? "" : this.#source.slice(start, end);

    if (end === -1 || raw.includes("<")) {
      throw invalidXml(at, `The value of ${name} is not closed with ${quote}, or holds a < (write &lt;).`);
    }

    this.#index = end + 1;
    props[name] = decodeEntities(raw, at);
  }

  #name(expected: string): string {
    XML_NAME.lastIndex = this.#index;

    const match = XML_NAME.exec(this.#source);

    if (match === null) {
      throw invalidXml(this.#locate(this.#index), `Expected ${expected}.`);
    }

    this.#index += match[0].length;

    return match[0];
  }

  #expect(text: string): void {
    if (!this.#source.startsWith(text, this.#index)) {
      throw invalidXml(this.#locate(this.#index), `Expected ${text}.`);
    }

    this.#index += text.length;
  }

  #skipSpace(): void {
    while (/\s/.test(this.#source[this.#index] ?? "")) {
      this.#index += 1;
    }
  }

  /** The index right after the next `close`; fails with `reason` if there is none. */
  #after(close: string, reason: string): number {
    const end = this.#source.indexOf(close, this.#index);

    if (end === -1) {
      throw invalidXml(this.#locate(this.#index), reason);
    }

    return end + close.length;
  }

  /** The line and column of a position: the last line starting at or before it, found by halving. */
  #locate(index: number): XmlLocation {
    let line = 0;

    for (let high = this.#lineStarts.length - 1; line < high; ) {
      const middle = Math.ceil((line + high) / 2);

      if ((this.#lineStarts[middle] ?? 0) <= index) {
        line = middle;
      } else {
        high = middle - 1;
      }
    }

    return {
      line: line + 1,
      column: index - (this.#lineStarts[line] ?? 0) + 1,
    };
  }
}
