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

/** Errors in the XML's order, by line then column; errors at one place keep theirs. */
export function sortedErrors(errors: readonly ApplyError[]): ApplyError[] {
  return errors.toSorted((a, b) => a.line - b.line || a.column - b.column);
}
