import type { ApplyElement } from "../types.ts";

/** The elements of a call by their refs. */
export function refsOf(elements: readonly ApplyElement[]): Map<string, ApplyElement> {
  return new Map(elements.map((element) => [element.ref, element]));
}

/**
 * The layer an element inside a copy is compared with: the source's layer it names, since a copy starts as its
 * source. Inside a new instance none: its layers start as the component's, so all its element gives is written.
 */
export function comparedSource(element: ApplyElement, byRef: ReadonlyMap<string, ApplyElement>): string | undefined {
  return element.copy === undefined || byRef.get(element.copy)?.attributes.copyOf !== undefined
    ? element.source
    : undefined;
}

/** The layers a call reads before it writes: those it changes, the sources its copies' layers stand for, the copied. */
export function layersToRead(elements: readonly ApplyElement[]): string[] {
  const byRef = refsOf(elements);

  return [
    ...new Set(
      elements.flatMap((element) =>
        [element.id, comparedSource(element, byRef), element.attributes.copyOf].filter(
          (id): id is string => id !== undefined && id !== null,
        ),
      ),
    ),
  ];
}
