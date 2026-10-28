// Planted: a tool imports a sibling tool. Refused by tools-apart.
import { BetaTool } from "../beta/beta.tool.ts";

export class AlphaTool {
  run(): string {
    return `alpha ${new BetaTool().run()}`;
  }
}
