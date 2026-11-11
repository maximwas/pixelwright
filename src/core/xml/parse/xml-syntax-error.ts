import { XML_PARSE_TEXT } from "@/core/xml/parse/parse.constants.ts";
import type { XmlLocation, XmlProblem } from "@/core/xml/parse/parse.types.ts";

/** Thrown inside one parse to stop at the first fault; XmlParser turns it into a value. */
export class XmlSyntaxError extends Error {
  readonly problem: XmlProblem;

  constructor(at: XmlLocation, reason: string) {
    const message = XML_PARSE_TEXT.invalid(at.line, at.column, reason);

    super(message);
    this.problem = { line: at.line, column: at.column, message };
  }
}
