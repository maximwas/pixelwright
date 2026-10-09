import slugify from "slugify";

/**
 * A file-safe name from a layer name, its letters transliterated (Ukrainian rules for Cyrillic):
 * `tokyo-magnifier 2` → `tokyo-magnifier-2`, `Логотип компанії` → `lohotyp-kompaniyi`, an empty one → `asset`.
 */
export function slug(name: string): string {
  // Separators become spaces first: slugify's strict mode would drop them and run "1.5" into "15".
  const cleaned = slugify(name.replace(/[\\/.,:;_+|()[\]{}]+/g, " "), {
    lower: true,
    strict: true,
    locale: "uk",
  })
    .slice(0, 60)
    .replace(/-+$/, "");

  return cleaned === "" ? "asset" : cleaned;
}
