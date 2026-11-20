import type { XmlParseResult } from "@/core/xml/parse/parse.types.ts";
import { XmlReader } from "@/core/xml/parse/xml-reader.ts";
import { XmlSyntaxError } from "@/core/xml/parse/xml-syntax-error.ts";

/**
 * XML as elements and text, strictly (C-001): a tag left open, a stray closing tag, a bare `&` fails with its line and
 * column, since a guess would put nodes in the wrong place. Several top-level elements are fine; names may hold `$`.
 */
export class XmlParser {
  parse(source: string): XmlParseResult {
    try {
      return { ok: true, nodes: new XmlReader(source).read() };
    } catch (error) {
      if (error instanceof XmlSyntaxError) {
        return { ok: false, error: error.problem };
      }

      throw error;
    }
  }
}
