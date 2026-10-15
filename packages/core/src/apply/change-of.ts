import { type LayerNow, writeElement } from "../css-mapping/write-element.ts";
import { errorAt } from "./problems.ts";
import type { ApplyChange, ApplyElement, ApplyError } from "./types.ts";

/**
 * An element as a change in Figma's terms: what the mapping writes for it (with `now`, only what the layer does not
 * have yet), in the envelope the plugin places it by. Errors stand where the XML has them, a span's at the span, and
 * come in the order of the element's attributes.
 */
export function changeOf(element: ApplyElement, now?: LayerNow): { change: ApplyChange; errors: ApplyError[] } {
  const write = writeElement(element, now);
  const { attributes } = element;
  const order = Object.keys(attributes);
  const rank = (error: ApplyError) => {
    const index = error.attribute === undefined ? -1 : order.indexOf(error.attribute);

    return index === -1 ? order.length : index;
  };
  const errors = write.problems.map((problem) =>
    errorAt(problem.piece === undefined ? element : (element.content?.[problem.piece] ?? element), element.id, problem),
  );

  return {
    change: {
      line: element.line,
      column: element.column,
      kind: element.id === null && element.source === undefined ? "create" : "update",
      ref: element.ref,
      id: element.id,
      tag: element.tag,
      parent: element.parent,
      index: element.index,
      ...(attributes.before === undefined ? {} : { before: attributes.before }),
      ...(attributes.after === undefined ? {} : { after: attributes.after }),
      props: write.props,
      sources: write.sources,
      ...(write.text === undefined ? {} : { text: write.text }),
      ...(attributes.copyOf === undefined ? {} : { copyOf: attributes.copyOf }),
      ...(element.source === undefined ? {} : { source: element.source }),
      ...(element.copy === undefined ? {} : { copy: element.copy }),
    },
    errors: errors.toSorted((a, b) => rank(a) - rank(b)),
  };
}
