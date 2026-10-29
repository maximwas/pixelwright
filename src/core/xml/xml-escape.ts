import { InjectionToken, injectable } from "@needle-di/core";
import { ATTRIBUTE_ESCAPE } from "@/core/xml/xml.constants.ts";

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
}

export const XML_ESCAPE = new InjectionToken<XmlEscape>("XmlEscape");
