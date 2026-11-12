import { InjectionToken, inject, injectable } from "@needle-di/core";
import { constructURL } from "google-fonts-helper";
import { FONT_DIRECTORY, type ServedFonts } from "@/core/ports/font-directory.port.ts";
import { FONTS_CHECK_TEXT, GOOGLE_CSS2 } from "@/server/tools/fonts-check/fonts-check.constants.ts";
import type { CheckedFont, FontsChecked } from "@/server/tools/fonts-check/fonts-check.schema.ts";

/**
 * Where a build gets each font a read uses (T-101): whether Google Fonts serves the family, its css2 link for the
 * weights used (google-fonts-helper 3.7.4 builds it: upright weights first, then italics) and the weights Google
 * lacks; a family Google does not serve needs its own files. Offline, every family is listed with google null.
 */
@injectable()
export class FontSources {
  readonly #directory;

  constructor(directory = inject(FONT_DIRECTORY)) {
    this.#directory = directory;
  }

  /** `fonts`: each family with its weights, as design_read's JSON lists them. */
  async check(fonts: Readonly<Record<string, readonly string[]>>): Promise<FontsChecked> {
    const served = await this.#directory.families();
    const checked = Object.entries(fonts).map(([family, weights]) => this.#font(family, [...weights], served));

    return {
      summary:
        served.error === null
          ? FONTS_CHECK_TEXT.served(checked.length, checked.filter(({ google }) => google ?? false).length)
          : FONTS_CHECK_TEXT.offline(checked.length, served.error),
      fonts: checked,
    };
  }

  #font(
    family: string,
    weights: string[],
    served: ServedFonts,
  ): CheckedFont {
    if (served.families === null) {
      return { family, weights, google: null };
    }

    const styles = served.families.get(family);

    if (styles === undefined) {
      return { family, weights, google: false, note: FONTS_CHECK_TEXT.notServed };
    }

    const missing = weights.filter((weight) => !styles.includes(weight));
    const css = this.#link(family, weights);

    return {
      family,
      weights,
      google: true,
      ...(css === false ? {} : { css }),
      ...(missing.length === 0 ? {} : { note: FONTS_CHECK_TEXT.missing(missing) }),
    };
  }

  /** Google's css2 link that loads the family in the weights used. */
  #link(family: string, weights: readonly string[]): string | false {
    const upright = weights.filter((weight) => !weight.endsWith(GOOGLE_CSS2.italic));
    const italic = weights.filter((weight) => weight.endsWith(GOOGLE_CSS2.italic));
    const numbers = (list: readonly string[]) => list.map((weight) => Number.parseInt(weight, 10));

    return constructURL({
      families: {
        [family]: {
          ...(upright.length === 0 ? {} : { wght: numbers(upright) }),
          ...(italic.length === 0 ? {} : { ital: numbers(italic) }),
        },
      },
      display: GOOGLE_CSS2.display,
    });
  }
}

export const FONT_SOURCES = new InjectionToken<FontSources>("FontSources");
