import type { WriteProblem } from "../css-mapping/write-element.ts";
import type { XmlLocation } from "../types/xml.ts";
import type { ApplyError } from "./types.ts";

/** An error design_apply returns for what an element could not write: where in the XML, the layer, the attribute. */
export function errorAt(where: XmlLocation, id: string | null, problem: WriteProblem): ApplyError {
  return {
    line: where.line,
    column: where.column,
    ...(id === null ? {} : { id }),
    attribute: problem.attribute,
    message: problem.message,
    ...(problem.hint === undefined ? {} : { hint: problem.hint }),
  };
}
