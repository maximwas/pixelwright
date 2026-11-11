import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_TEXT } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";

/**
 * The write halves in the mapping table's order (Registry, C-172): each runs when an attribute it owns changed. Like
 * the read side, each attribute has one writer, and two that own the same one are refused when the registry is built.
 */
@injectable()
export class WriteRegistry {
  readonly #writers;

  constructor(writers = inject(PROPERTY_WRITERS, { multi: true })) {
    const owned = writers.flatMap((writer) => writer.attributes);
    const shared = owned.find((attribute, index) => owned.indexOf(attribute) !== index);

    if (shared !== undefined) {
      throw new Error(CSS_TEXT.sharedAttribute(shared));
    }

    this.#writers = writers;
  }

  write(input: WriteInput, out: WriteOutput): void {
    for (const writer of this.#writers) {
      if (writer.attributes.some(input.changed)) {
        writer.write(input, out);
      }
    }
  }
}

export const WRITE_REGISTRY = new InjectionToken<WriteRegistry>("WriteRegistry");

/** The property writers in the mapping table's order. */
export const PROPERTY_WRITERS = new InjectionToken<PropertyWriter>("PropertyWriters");
