import { closest, type FontSpec, weightOf } from "@pixelwright/core";
import { WriteError } from "./write-error.ts";

/** The fonts this Figma has, asked for once per plugin run (and again for another `figma`, as tests install). */
let cache: { readonly api: PluginAPI; readonly fonts: Promise<Font[]> } | null = null;

function availableFonts(): Promise<Font[]> {
  if (cache?.api !== figma) {
    cache = {
      api: figma,
      fonts: figma.listAvailableFontsAsync(),
    };
  }

  return cache.fonts;
}

/** A font as a key for maps: family, weight and slant. */
export function fontKey(spec: Pick<FontSpec, "family" | "weight" | "italic">): string {
  return `${spec.family.toLowerCase()} ${spec.weight}${spec.italic ? " italic" : ""}`;
}

/** The family's style with the weight and slant asked for; else an error naming the styles the family has. */
export async function fontNameOf(spec: FontSpec): Promise<FontName> {
  const fonts = await availableFonts();
  const family = spec.family.toLowerCase();
  const styles = fonts.map(({ fontName }) => fontName).filter((font) => font.family.toLowerCase() === family);

  if (styles.length === 0) {
    const near = closest(spec.family, new Set(fonts.map(({ fontName }) => fontName.family)));

    throw new WriteError(
      `Figma has no font family ${spec.family}.`,
      near === null ? "Install it, or use a family the file has." : `Did you mean ${near}?`,
    );
  }

  const matching = styles
    .filter((font) => weightOf(font.style) === spec.weight && /italic|oblique/i.test(font.style) === spec.italic)
    .sort((a, b) => a.style.length - b.style.length);
  const [best] = matching;

  if (best === undefined) {
    throw new WriteError(
      `${styles[0]?.family ?? spec.family} has no weight ${spec.weight}${spec.italic ? " italic" : ""}: it has ${styles.map((font) => font.style).join(", ")}.`,
    );
  }

  return best;
}
