import { inject, injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { CATALOGUE_TEXT } from "@/core/design/text/text.constants.ts";
import { FONT_DIRECTORY_FALLBACK, type FontDirectory, type ServedFonts } from "@/core/ports/font-directory.port.ts";
import { FONTSOURCE } from "@/server/adapters/http/http.constants.ts";
import { FontsourceFontsSchema } from "@/server/adapters/http/http.schema.ts";

/**
 * What Google Fonts serves, from Fontsource's API first (A§15.5), else from the fallback (Google's own catalogue). Read
 * once for the server; a read that failed both ways is forgotten, so the next call tries again.
 */
@injectable()
export class FontsourceDirectory implements FontDirectory {
  readonly #fallback;
  #served: Promise<ServedFonts> | null = null;

  constructor(fallback = inject(FONT_DIRECTORY_FALLBACK)) {
    this.#fallback = fallback;
  }

  families(): Promise<ServedFonts> {
    this.#served ??= this.#read().then((served) => {
      if (served.error !== null) {
        this.#served = null;
      }

      return served;
    });

    return this.#served;
  }

  async #read(): Promise<ServedFonts> {
    try {
      const response = await fetch(FONTSOURCE.url, { signal: AbortSignal.timeout(FONTSOURCE.timeoutMs) });

      if (!response.ok) {
        return await this.#fallback.families();
      }

      const fonts = zod.parse(FontsourceFontsSchema, await response.json());

      return {
        families: new Map(fonts.map(({ family, weights, styles }) => [family, this.#weights(weights, styles)])),
        error: null,
      };
    } catch {
      return await this.#fallback.families();
    }
  }

  /** Each weight in each style, as design_read writes them: "400", "400 italic". */
  #weights(weights: readonly number[], styles: readonly string[]): string[] {
    return styles.flatMap((style) =>
      weights.map((weight) => CATALOGUE_TEXT.weight(weight, style === FONTSOURCE.italic)),
    );
  }
}
