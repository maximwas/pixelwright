import fc from "fast-check";
import { expect, it } from "vitest";
import { XmlEscape } from "@/core/xml/xml-escape.ts";

const xmlEscape = new XmlEscape();

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"' };

/** An attribute value as an XML parser reads it back: the named references and the numeric ones. */
const readBack = (value: string): string =>
  value.replace(/&(?:#(\d+)|(amp|lt|gt|quot));/g, (_reference, code: string | undefined, name: string) =>
    code === undefined ? (NAMED[name] ?? name) : String.fromCodePoint(Number(code)),
  );

/** Text made mostly of what must be escaped, and any text at all. */
const TEXT = fc.oneof(
  fc.string({
    unit: fc.constantFrom("&", "<", ">", '"', "'", "\n", "\r", "\t", "\u2028", "\u2029", ";", "#", "a", "é", "😀"),
  }),
  fc.string({ unit: "binary" }),
);

// §1.1: a value stays inside its double quotes and on its tag's line, `>` escaped too, and reads back as written.
it('round trips any text through a double-quoted attribute, leaving no raw < > " or line break', () => {
  fc.assert(
    fc.property(TEXT, (text) => {
      const escaped = xmlEscape.attribute(text);

      expect(escaped).not.toMatch(/[<>"\n\r\t\u2028\u2029]/);
      expect(readBack(escaped)).toBe(text);
    }),
  );
});
