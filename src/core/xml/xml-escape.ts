import { InjectionToken, injectable } from "@needle-di/core";
import { ATTRIBUTE_ESCAPE, TEXT_ESCAPE } from "@/core/xml/xml.constants.ts";

/** Text made safe for light XML (§1.1). */
@injectable()
export class XmlEscape {
  /** A value safe inside a double-quoted attribute; line breaks become references, so each tag stays on one line. */
  attribute(value: string): string {
    return value.replace(
      ATTRIBUTE_ESCAPE.pattern,
      (character) => ATTRIBUTE_ESCAPE.references[character as keyof typeof ATTRIBUTE_ESCAPE.references],
    );
  }

  /** Characters safe between a Text's tags; a text of spaces only keeps its spaces as references. */
  text(value: string): string {
    const escaped = value.replace(
      TEXT_ESCAPE.pattern,
      (character) => ATTRIBUTE_ESCAPE.references[character as keyof typeof ATTRIBUTE_ESCAPE.references],
    );

    return value.trim() === "" ? escaped.replace(TEXT_ESCAPE.space, TEXT_ESCAPE.spaceReference) : escaped;
  }
}

export const XML_ESCAPE = new InjectionToken<XmlEscape>("XmlEscape");
