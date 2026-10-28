// Planted: the kernel reaches up into another core domain, through the @/ alias: dependency-cruiser must see the real
// path behind it. Refused by kernel-on-nothing.
import { XmlEscaper } from "@/core/xml/xml-escaper.ts";

export class TokenNamer {
  readonly #escaper = new XmlEscaper();

  name(label: string): string {
    return this.#escaper.escape(label);
  }
}
