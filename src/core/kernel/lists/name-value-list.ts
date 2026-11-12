import { InjectionToken, injectable } from "@needle-di/core";
import { LIST, LIST_PATTERN } from "@/core/kernel/lists/lists.constants.ts";

/**
 * A `Name=Value, Other=Value` list (K-069): a variant as Figma names it ("State=Hover, Size=L"), a component's
 * properties as reads write them. A comma, equals sign or backslash inside a name or value is escaped with a backslash.
 */
@injectable()
export class NameValueList {
  /** The values by name, each side trimmed; null when an item names no property (only a trailing comma may). */
  parse(text: string): Record<string, string> | null {
    const items = this.#split(text);
    const pairs: [string, string][] = [];

    for (const [index, item] of items.entries()) {
      const [at] = this.#marks(item, LIST.pair);

      if (at !== undefined) {
        pairs.push([this.#unescaped(item.slice(0, at)).trim(), this.#unescaped(item.slice(at + 1)).trim()]);
      } else if (index < items.length - 1 || this.#unescaped(item).trim() !== "") {
        return null;
      }
    }

    return Object.fromEntries(pairs);
  }

  /** The values as one list, every mark in a name or value escaped: what parse reads back. */
  write(values: Readonly<Record<string, string>>): string {
    return Object.entries(values)
      .map((pair) => pair.map((part) => part.replace(LIST_PATTERN.marks, LIST.escaped)).join(LIST.pair))
      .join(LIST.itemJoiner);
  }

  /** The items between unescaped commas, their escapes kept. */
  #split(text: string): string[] {
    const items: string[] = [];
    let start = 0;

    for (const at of this.#marks(text, LIST.item)) {
      items.push(text.slice(start, at));
      start = at + 1;
    }

    items.push(text.slice(start));

    return items;
  }

  /** Where the mark stands unescaped in the text: a backslash keeps the character after it. */
  #marks(text: string, mark: string): number[] {
    const found: number[] = [];

    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === LIST.escape) {
        index += 1;
      } else if (text[index] === mark) {
        found.push(index);
      }
    }

    return found;
  }

  #unescaped(text: string): string {
    return text.replace(LIST_PATTERN.escape, LIST.unescaped);
  }
}

export const NAME_VALUE_LIST = new InjectionToken<NameValueList>("NameValueList");
