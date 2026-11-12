import { InjectionToken, injectable } from "@needle-di/core";
import { STYLE_NUMBERS, STYLE_NUMBERS_TEXT } from "@/core/tokens/names/names.constants.ts";

/** What numbering needs to know of a style. */
export interface NumberedStyle {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly remote: boolean;
}

/**
 * The one numbering of same-named styles (T-163, B-044, D-29): each style that shares its kind and name with another
 * gets its number, the file's own first, by id, then library ones, by id; 1 keeps the plain token name, 2 and on get
 * `--Name-2`. Every reader numbers over the same set (the file's own styles and those used on the page read), so
 * design_read, tokens_read and design_apply mean one style by one name.
 * Known quirk (D-29, accepted): the library styles in the set are those the read's page uses, so a read from another
 * page may number a library's same-named styles differently; the file's own come first and never depend on the page.
 */
@injectable()
export class StyleNumbers {
  /** Style id → its number, for the styles that share their kind and name; the rest are left out. */
  numbers(styles: readonly NumberedStyle[]): Map<string, number> {
    const groups = new Map<string, Map<string, NumberedStyle>>();

    for (const style of styles) {
      const key = STYLE_NUMBERS_TEXT.key(style.type, style.name);
      const group = groups.get(key) ?? new Map<string, NumberedStyle>();

      if (!group.has(style.id)) {
        group.set(style.id, style);
      }

      groups.set(key, group);
    }

    const numbers = new Map<string, number>();

    for (const group of groups.values()) {
      if (group.size < STYLE_NUMBERS.shared) {
        continue;
      }

      const ordered = [...group.values()].sort(
        (first, second) => Number(first.remote) - Number(second.remote) || this.#compare(first.id, second.id),
      );

      for (const [index, style] of ordered.entries()) {
        numbers.set(style.id, index + STYLE_NUMBERS.first);
      }
    }

    return numbers;
  }

  /** Ids in code-unit order, as 0.7.0 sorted them (not by locale). */
  #compare(first: string, second: string): number {
    if (first === second) {
      return 0;
    }

    return first < second ? -1 : 1;
  }
}

export const STYLE_NUMBERS_READER = new InjectionToken<StyleNumbers>("StyleNumbers");
