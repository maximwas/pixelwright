import { decodeHTMLStrict } from "entities/decode";
import { XML_PARSE, XML_PARSE_TEXT } from "@/core/xml/parse/parse.constants.ts";
import type { XmlLocation } from "@/core/xml/parse/parse.types.ts";
import { XmlSyntaxError } from "@/core/xml/parse/xml-syntax-error.ts";

/** The rules for the characters of a text or a value: its entities (C-003, D-17) and its whitespace (C-004, B-059). */
export class XmlText {
  /** The raw text with its entity references resolved. `at` is where the raw text starts, for the error. */
  decode(raw: string, at: XmlLocation): string {
    let decoded = "";
    let index = 0;

    for (let amp = raw.indexOf(XML_PARSE.chars.amp); amp !== -1; amp = raw.indexOf(XML_PARSE.chars.amp, index)) {
      XML_PARSE.entity.lastIndex = amp;

      const match = XML_PARSE.entity.exec(raw);
      const value = match === null ? undefined : this.#entity(match);

      if (match === null || value === undefined) {
        throw new XmlSyntaxError(at, XML_PARSE_TEXT.noEntity(raw.slice(amp, amp + XML_PARSE.entityPreview)));
      }

      decoded += raw.slice(index, amp) + value;
      index = amp + match[0].length;
    }

    return decoded + raw.slice(index);
  }

  /**
   * Text between tags without the indentation around it: every line is trimmed, lines are joined by one space and
   * whitespace-only lines vanish; a run of spaces alone on its line (between two spans) stays as written. Spaces inside
   * a line stay; `&#32;` keeps an edge space, since entities are decoded after this. "" means the text is dropped.
   * (React's rule for JSX text.)
   */
  clean(raw: string): string {
    const lines = raw.replaceAll(XML_PARSE.chars.tab, XML_PARSE.chars.space).split(XML_PARSE.lineBreak);
    const lastContentLine = lines.map((line) => /[^ ]/.test(line)).lastIndexOf(true);
    let text = "";

    lines.forEach((line, index) => {
      let trimmed = line;

      if (index > 0) {
        trimmed = trimmed.replace(/^ +/, "");
      }

      if (index < lines.length - 1) {
        trimmed = trimmed.replace(/ +$/, "");
      }

      if (trimmed !== "") {
        // A space joins a line to the content after it: none after the last, nor on a line with no content after it.
        text += index < lastContentLine ? trimmed + XML_PARSE.chars.space : trimmed;
      }
    });

    return text;
  }

  #entity([whole, hex, decimal]: RegExpExecArray): string | undefined {
    if (hex === undefined && decimal === undefined) {
      const named = decodeHTMLStrict(whole);

      return named === whole ? undefined : named;
    }

    const code = hex === undefined ? Number(decimal) : Number.parseInt(hex, 16);

    return code === 0 || code > XML_PARSE.maxCodePoint ? undefined : String.fromCodePoint(code);
  }
}
