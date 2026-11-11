import { InjectionToken, injectable } from "@needle-di/core";
import type { ApplyElement } from "@/core/apply/apply.types.ts";

/** What a call reads before it writes (C-169): the layers it changes, the sources of its copies' layers, the copied. */
@injectable()
export class LayerReads {
  /** The elements of a call by their refs. */
  byRef(elements: readonly ApplyElement[]): Map<string, ApplyElement> {
    return new Map(elements.map((element) => [element.ref, element]));
  }

  /**
   * The layer an element inside a copy is compared with: the source's layer it names, since a copy starts as its
   * source. Inside a new instance none: its layers start as the component's, so all its element gives is written.
   */
  compared(element: ApplyElement, byRef: ReadonlyMap<string, ApplyElement>): string | undefined {
    return element.copy === undefined || byRef.get(element.copy)?.attributes.copyOf !== undefined
      ? element.source
      : undefined;
  }

  /** The layer an element is read against: its id, else its compared source, else the layer it copies. */
  named(element: ApplyElement, byRef: ReadonlyMap<string, ApplyElement>): string | null {
    return element.id ?? this.compared(element, byRef) ?? element.attributes.copyOf ?? null;
  }

  /** The ids to read, each once, in the order the elements name them. */
  ids(elements: readonly ApplyElement[]): string[] {
    const byRef = this.byRef(elements);

    return [
      ...new Set(
        elements.flatMap((element) =>
          [element.id, this.compared(element, byRef), element.attributes.copyOf].filter(
            (id): id is string => id !== undefined && id !== null,
          ),
        ),
      ),
    ];
  }
}

export const LAYER_READS = new InjectionToken<LayerReads>("LayerReads");
