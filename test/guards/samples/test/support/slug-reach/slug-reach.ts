// Planted: test code reaches src with ../ instead of the @/ alias. Refused by no-restricted-imports. Not named
// .test.ts, so vitest never runs it.
import { SlugMaker } from "../../../src/core/kernel/names/slug/slug.ts";

export class SlugReach {
  readonly #slugs = new SlugMaker();

  of(name: string): string {
    return this.#slugs.make(name);
  }
}
