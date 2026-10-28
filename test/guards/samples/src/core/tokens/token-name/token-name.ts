// Planted: a core domain reaches past another domain's index.ts (K-100), through the @/ alias: dependency-cruiser must
// see the real path behind it. Refused by core-domains-by-index.
import { SlugMaker } from "@/core/kernel/names/slug/slug.ts";

export class TokenNamer {
  readonly #slugs = new SlugMaker();

  name(label: string): string {
    return this.#slugs.make(label);
  }
}
