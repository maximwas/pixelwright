// Planted: a tool imports a sibling tool. Refused by tools-apart.
import { beta } from "../beta/beta.tool.ts";

export function alpha(): string {
  return `alpha ${beta()}`;
}
