// Planted: an import that climbs with ../ instead of the @/ alias. Refused by no-relative-import-paths.
import { SlugMaker } from "../slug/slug.ts";

export class SlugLength {
  readonly #slugs = new SlugMaker();

  of(name: string): number {
    return this.#slugs.make(name).length;
  }
}
