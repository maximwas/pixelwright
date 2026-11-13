import { PIN_WORDS, PINS, TEXT_PIN_WORDS } from "@/core/css/groups/element/element.constants.ts";

/**
 * The properties a Dev Mode note pins, as Figma's annotation property types and as a note's CSS words (C-1.5): design_read
 * writes the words, design_apply reads them back, the plugin pins their types. A text's fills are its colour; a type
 * Figma adds later is its own word.
 */
export class PinWords {
  /** The words for these types, each once, in the order pinned. */
  said(types: readonly string[], text: boolean): string {
    return [...new Set(types.map((type) => this.#word(type, text)))].join(PINS.separator);
  }

  /** Words as a note's bracket lists them. */
  listed(words: readonly string[]): string {
    return words.join(PINS.separator);
  }

  /** Whether every word names a property a note can pin. */
  known(words: readonly string[], text: boolean): boolean {
    return words.every((word) => this.#types(word, text).length > 0);
  }

  /** The types these words pin, each once, in their order (`grid-row` is a row's start and its span). */
  types(words: readonly string[], text: boolean): string[] {
    return [...new Set(words.flatMap((word) => this.#types(word, text)))];
  }

  #word(type: string, text: boolean): string {
    return (text ? TEXT_PIN_WORDS[type] : undefined) ?? PIN_WORDS[type] ?? type;
  }

  #types(word: string, text: boolean): string[] {
    const named = Object.keys(PIN_WORDS).filter((type) => this.#word(type, text) === word);

    return named.length > 0 || !Object.hasOwn(PIN_WORDS, word) ? named : [word];
  }
}
