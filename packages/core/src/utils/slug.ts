/** A file-safe name from a layer name: `tokyo-magnifier 2` → `tokyo-magnifier-2`, an empty one → `asset`. */
export function slug(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

  return cleaned === "" ? "asset" : cleaned;
}
