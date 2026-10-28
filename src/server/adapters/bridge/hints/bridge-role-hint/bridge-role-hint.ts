import { injectable } from "@needle-di/core";
import { CLOSE_CODE } from "../../../../../shared/protocol/protocol.constants.ts";
import type { HintFacts, StatusHint } from "../status-hints/status-hints.types.ts";

/** First row: a bridge that is off, broken, handed over or out of reach says so before anything else. */
@injectable()
export class BridgeRoleHint implements StatusHint {
  applies({ role }: HintFacts): boolean {
    return role !== "owner" && role !== "peer";
  }

  text(facts: HintFacts): string | null {
    switch (facts.role) {
      case "disabled":
        return "The plugin bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): remove the variable and restart the MCP server.";
      case "failed":
        return `The plugin bridge could not start: ${facts.failure ?? "no reason was given."}`;
      case "handedOver":
        return "A newer Pixelwright server, another MCP client's, took the Figma bridge over, so this one switched its bridge off: restart Pixelwright in this MCP client (/mcp in Claude Code) to reach Figma again.";
      case "unavailable":
        return this.#unavailable(facts);
      default:
        return null;
    }
  }

  /** Who holds the port, as far as the way it closed this server's socket tells. */
  #unavailable({ closeCode, port }: HintFacts): string {
    if (closeCode === CLOSE_CODE.handedOver) {
      return `A newer Pixelwright server is taking the bridge over on port ${port}: this session joins it in a moment.`;
    }

    return closeCode === CLOSE_CODE.versionMismatch
      ? `Another MCP client session runs another Pixelwright version and holds port ${port}: run the same version in both, or close that session. This one keeps retrying.`
      : `Port ${port} is held by a program that is not Pixelwright: free it. This session keeps retrying.`;
  }
}
