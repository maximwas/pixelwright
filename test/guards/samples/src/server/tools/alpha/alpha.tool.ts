// Planted: a tool imports a sibling tool, through the @/ alias. Refused by tools-apart.
import { BetaTool } from "@/server/tools/beta/beta.tool.ts";

export class AlphaTool {
  run(): boolean {
    return !new BetaTool().run();
  }
}
