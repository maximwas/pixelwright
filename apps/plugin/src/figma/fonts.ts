import { closest, type FontSpec, weightOf } from "@pixelwright/core";
import { NEAR_FONT_WEIGHT } from "../constants/plugin.ts";
import type { KnownFont } from "../types/apply.ts";
import { WriteError } from "./write-error.ts";

/** A font as a key for maps: family, weight and slant. */
export function fontKey(spec: Pick<FontSpec, "family" | "weight" | "italic">): string {
  return `${spec.family.toLowerCase()} ${spec.weight}${spec.italic ? " italic" : ""}`;
}

/** The fonts this Figma has, asked for once (and again for another `figma`, as tests install), and the one a spec means. */
export class FontCatalog {
  #cache: { readonly api: PluginAPI; readonly fonts: Promise<Font[]> } | null = null;

  /**
   * The font for a family, weight and slant: the one a changed text already uses for them (design_read wrote its
   * weight), else the family's style nearest that weight with that slant (a plain Regular before a Book of the same
   * weight); an error names the styles the family has when none is near.
   */
  async fontNameOf(spec: FontSpec, known: readonly KnownFont[] = []): Promise<FontName> {
    const family = spec.family.toLowerCase();
    const slanted = (style: string) => /italic|oblique/i.test(style) === spec.italic;
    const used = known.find(
      ({ fontName, weight }) =>
        fontName.family.toLowerCase() === family && weight === spec.weight && slanted(fontName.style),
    );

    if (used !== undefined) {
      return used.fontName;
    }

    const fonts = await this.#available();
    const styles = fonts.map(({ fontName }) => fontName).filter((font) => font.family.toLowerCase() === family);

    if (styles.length === 0) {
      const near = closest(spec.family, new Set(fonts.map(({ fontName }) => fontName.family)));

      throw new WriteError(
        `Figma has no font family ${spec.family}.`,
        near === null ? "Install it, or use a family the file has." : `Did you mean ${near}?`,
      );
    }

    return nearestStyle(spec, styles, slanted);
  }

  #available(): Promise<Font[]> {
    if (this.#cache?.api !== figma) {
      this.#cache = {
        api: figma,
        fonts: figma.listAvailableFontsAsync(),
      };
    }

    return this.#cache.fonts;
  }
}

/** The family's style nearest the weight with the slant, a plain one first at equal distance; none near is an error. */
function nearestStyle(spec: FontSpec, styles: readonly FontName[], slanted: (style: string) => boolean): FontName {
  const plain = (style: string) => (/^(regular|italic|normal)$/i.test(style) ? 0 : style.length);
  const [best] = styles
    .filter((font) => slanted(font.style) && Math.abs(weightOf(font.style) - spec.weight) <= NEAR_FONT_WEIGHT)
    .sort(
      (a, b) =>
        Math.abs(weightOf(a.style) - spec.weight) - Math.abs(weightOf(b.style) - spec.weight) ||
        plain(a.style) - plain(b.style),
    );

  if (best === undefined) {
    throw new WriteError(
      `${styles[0]?.family ?? spec.family} has no weight ${spec.weight}${spec.italic ? " italic" : ""}: it has ${styles.map((font) => font.style).join(", ")}.`,
    );
  }

  return best;
}
