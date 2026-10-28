// Planted: a core domain reaches past another domain's index.ts (K-100). Refused by core-domains-by-index.
import { slug } from "../kernel/names/slug.ts";

export function tokenName(name: string): string {
  return `--${slug(name)}`;
}
