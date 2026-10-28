// Planted: the plugin imports a server-side core domain. Refused by plugin-no-server-core.
import { escapeXml } from "../../../core/xml/index.ts";

export function xmlRead(text: string): string {
  return escapeXml(text);
}
