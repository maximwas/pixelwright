import { attributeOf, type DesignElement, elementsOf } from "@pixelwright/core";
import type { CodeRead } from "../../code-connect/connect.ts";

/**
 * The code of the connected instances the read shows ($code, and the read's own layer): instances with the same code
 * once, with their ids; the errors of the layers it shows, once per template; the imports once each.
 */
export function codeOutput(code: CodeRead, root: DesignElement | null, layer: string) {
  const elements = elementsOf(root);
  const present = new Set(elements.map(({ id }) => id));
  const shown = new Set([
    layer,
    ...elements.filter((element) => attributeOf(element, "$code") !== undefined).map(({ id }) => id),
  ]);
  const codeComponents = code.components
    .map((group) => ({
      ...group,
      ids: group.ids.filter((id) => shown.has(id)),
    }))
    .filter((group) => group.ids.length > 0);
  const codeErrors = code.errors
    .map((group) => ({
      ...group,
      ids: group.ids.filter((id) => present.has(id)),
    }))
    .filter((group) => group.ids.length > 0);

  return {
    codeComponents,
    ...(codeErrors.length === 0 ? {} : { codeErrors }),
    imports: [...new Set(codeComponents.flatMap((group) => group.imports))],
  };
}
