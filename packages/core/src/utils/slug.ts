import slugify from "slugify";

/**
 * A file-safe name from a layer name, its letters transliterated (Ukrainian rules for Cyrillic):
 * `tokyo-magnifier 2` → `tokyo-magnifier-2`, `Логотип компанії` → `lohotyp-kompaniyi`, an empty one → `asset`.
 */
export function slug(name: string): string {
  // Every run of anything but letters, digits and marks parts words first: slugify's strict mode would drop it and run
  // "State=Default" into "statedefault". NFKC folds ligatures and the like ("ﬁ" → "fi"); apostrophes join ("Kid's").
  const words = name
    .normalize("NFKC")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ");
  const cleaned = slugify(words, {
    lower: true,
    strict: true,
    locale: "uk",
  })
    .slice(0, 60)
    .replace(/-+$/, "");

  return cleaned === "" ? "asset" : cleaned;
}
