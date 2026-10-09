import { BridgeError } from "../../bridge/protocol.ts";
import type { XmlLocation } from "../../types/xml.ts";

/** INVALID_XML naming where: the message for the model, the line and column as data for design_apply's errors. */
export function invalidXml(at: XmlLocation | null, reason: string): BridgeError {
  const where = at === null ? "" : ` at line ${at.line}, column ${at.column}`;

  return new BridgeError("INVALID_XML", `Invalid XML${where}: ${reason}`, at);
}
