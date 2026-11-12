// Planted: the plugin imports a server-side core domain, through the @/ alias. Refused by plugin-no-server-core.
import { XmlEscaper } from "@/core/xml/xml-escaper.ts";

export class XmlReadOperation {
  readonly #escaper = new XmlEscaper();

  run(text: string): string {
    return this.#escaper.escape(text);
  }
}
