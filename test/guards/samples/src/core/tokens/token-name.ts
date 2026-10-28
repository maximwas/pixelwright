// Planted: a core domain reaches past another domain's index.ts (K-100). Refused by core-domains-by-index.
import { SlugMaker } from "../kernel/names/slug.ts";

export class TokenNamer {
  readonly #slugs = new SlugMaker();

  name(label: string): string {
    return `--${this.#slugs.make(label)}`;
  }
}
