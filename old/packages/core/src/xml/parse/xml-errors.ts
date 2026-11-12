import { BridgeError } from "../../bridge/protocol.ts";
import type { XmlLocation } from "../../types/xml.ts";

/** INVALID_XML naming where: the message for the model, the line and column as data for design_apply's errors. */
export function invalidXml(at: XmlLocation | null, reason: string): BridgeError {
  const where = at === null ? "" : ` at line ${at.line}, column ${at.column}`;

  return new BridgeError("INVALID_XML", `Invalid XML${where}: ${reason}`, at);
}

/** An INVALID_XML error as where and why the XML went wrong (line 1, column 1 when it names no place); null for others. */
export function xmlSyntaxError(error: unknown): { line: number; column: number; message: string } | null {
  if (!(error instanceof BridgeError) || error.code !== "INVALID_XML") {
    return null;
  }

  const data: unknown = error.data;
  const place = isPlace(data) ? data : null;

  return {
    line: place?.line ?? 1,
    column: place?.column ?? 1,
    message: error.message,
  };
}

function isPlace(value: unknown): value is XmlLocation {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { line?: unknown }).line === "number" &&
    typeof (value as { column?: unknown }).column === "number"
  );
}
