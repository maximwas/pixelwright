import { InjectionToken, injectable } from "@needle-di/core";
import slugify from "slugify";
import { SLUG_RULE } from "@/core/kernel/names/names.constants.ts";

/**
 * A file-safe name from a layer name (K-075), its letters transliterated by slugify: `tokyo-magnifier 2` to
 * `tokyo-magnifier-2`, `Логотип компанії` to `lohotyp-kompaniyi`, at most 60 characters, `asset` when nothing is left.
 */
@injectable()
export class Slug {
  of(name: string): string {
    const words = name
      .normalize(SLUG_RULE.form)
      .replace(SLUG_RULE.apostrophes, SLUG_RULE.none)
      .replace(SLUG_RULE.separators, SLUG_RULE.space);
    const cleaned = slugify(words, { lower: true, strict: true, locale: SLUG_RULE.locale })
      .slice(0, SLUG_RULE.maxLength)
      .replace(SLUG_RULE.trailingDashes, SLUG_RULE.none);

    return cleaned === SLUG_RULE.none ? SLUG_RULE.empty : cleaned;
  }
}

export const SLUG = new InjectionToken<Slug>("Slug");
