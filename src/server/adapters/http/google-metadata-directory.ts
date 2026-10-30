import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { CATALOGUE_TEXT } from "@/core/design/text/text.constants.ts";
import type { FontDirectory, ServedFonts } from "@/core/ports/font-directory.port.ts";
import { GOOGLE_METADATA, HTTP_TEXT } from "@/server/adapters/http/http.constants.ts";
import { GoogleMetadataSchema } from "@/server/adapters/http/http.schema.ts";

/**
 * What Google Fonts serves, from its own catalogue (T-101, D-37): fonts_check's fallback when Fontsource cannot be
 * read. Any failure (offline, slow, an odd answer) is the error said, never thrown.
 */
@injectable()
export class GoogleMetadataDirectory implements FontDirectory {
  async families(): Promise<ServedFonts> {
    try {
      const response = await fetch(GOOGLE_METADATA.url, { signal: AbortSignal.timeout(GOOGLE_METADATA.timeoutMs) });

      if (!response.ok) {
        return { families: null, error: HTTP_TEXT.answered(GOOGLE_METADATA.url, response.status) };
      }

      const body = (await response.text()).replace(GOOGLE_METADATA.guard, "");
      const { familyMetadataList } = zod.parse(GoogleMetadataSchema, JSON.parse(body));

      return {
        families: new Map(
          familyMetadataList.map(({ family, fonts }) => [family, Object.keys(fonts).map(this.#weight)]),
        ),
        error: null,
      };
    } catch (error) {
      return { families: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** A font key ("400", "400i") as design_read writes the weight: "400", "400 italic". */
  readonly #weight = (key: string): string =>
    CATALOGUE_TEXT.weight(Number.parseInt(key, 10), key.endsWith(GOOGLE_METADATA.italic));
}
