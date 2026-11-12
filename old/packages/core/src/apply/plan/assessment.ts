import type { LayerNow } from "../../css-mapping/write-element.ts";
import type { ApplyElement, ApplyError, LayerEntry } from "../types.ts";
import { unchangedAttributes } from "../unchanged.ts";
import type { CurrentLayers } from "./current-layers.ts";
import { comparedSource, refsOf } from "./reads.ts";

/** An element with the layer it is compared with and what that layer holds now; neither for a create. */
export interface Assessment {
  readonly element: ApplyElement;
  readonly entry?: LayerEntry;
  readonly now?: LayerNow;
}

/**
 * Each element against the layer it names: what the layer holds already. A named layer the read could not take
 * (past its size budget) is refused rather than written whole, every attribute rounded; one the file does not hold
 * and a copy's own source go to the plugin, which answers for them.
 */
export function assessElements(
  elements: readonly ApplyElement[],
  layers: CurrentLayers,
): { assessed: Assessment[]; errors: ApplyError[] } {
  const byRef = refsOf(elements);
  const assessed: Assessment[] = [];
  const errors: ApplyError[] = [];

  for (const element of elements) {
    const named = element.id ?? comparedSource(element, byRef) ?? element.attributes.copyOf ?? null;
    const entry = named === null ? undefined : layers.entry(named);

    if (named !== null && entry === undefined && !layers.isMissing(named) && element.attributes.copyOf === undefined) {
      errors.push(unread(element, named));
      continue;
    }

    assessed.push(
      entry === undefined
        ? { element }
        : {
            element,
            entry,
            now: unchangedAttributes(element, entry, layers.tokens),
          },
    );
  }

  return {
    assessed,
    errors,
  };
}

function unread(element: ApplyElement, named: string): ApplyError {
  return {
    line: element.line,
    column: element.column,
    ...(element.id === null ? {} : { id: element.id }),
    // The read takes every layer named whole, layers inside included: a design_read sent back whole to move it fills it.
    message: `design_apply could not read ${named}'s current state: the layers this call names, with every layer inside them, are more than one call reads.`,
    hint: 'Leave out the layers that stay as they are: an element alone (<Frame id="…"/>) moves or changes its layer with everything inside it. Or split the call.',
  };
}
