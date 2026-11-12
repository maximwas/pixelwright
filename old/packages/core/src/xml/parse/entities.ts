import { XML_ENTITY, XML_NAMED_ENTITIES } from "../../constants/xml.ts";
import type { XmlLocation } from "../../types/xml.ts";
import { invalidXml } from "./xml-errors.ts";

/** Text or an attribute value with its entity references resolved. `at` is where the raw text starts. */
export function decodeEntities(raw: string, at: XmlLocation): string {
  let decoded = "";
  let index = 0;

  for (let amp = raw.indexOf("&"); amp !== -1; amp = raw.indexOf("&", index)) {
    XML_ENTITY.lastIndex = amp;

    const match = XML_ENTITY.exec(raw);
    const value = match === null ? undefined : entityValue(match);

    if (match === null || value === undefined) {
      throw invalidXml(at, `"${raw.slice(amp, amp + 10)}…" is no entity: write & as &amp;.`);
    }

    decoded += raw.slice(index, amp) + value;
    index = amp + match[0].length;
  }

  return decoded + raw.slice(index);
}

function entityValue([, hex, decimal, name]: RegExpExecArray): string | undefined {
  if (name !== undefined) {
    return XML_NAMED_ENTITIES[name];
  }

  const code = hex === undefined ? Number(decimal) : Number.parseInt(hex, 16);

  return code === 0 || code > 0x10ffff ? undefined : String.fromCodePoint(code);
}

/**
 * Text on the line of its tags, where edge spaces survive reading back. Line breaks and tabs would be read as
 * indentation, and text of spaces only as nothing: those become character references.
 */
export function inlineText(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\t", "&#9;")
    .replaceAll("\u2028", "&#8232;")
    .replaceAll("\u2029", "&#8233;");

  return text.trim() === "" ? escaped.replaceAll(" ", "&#32;") : escaped;
}
