import { BridgeError, type OperationOutput } from "@pixelwright/core";
import type { PluginSession } from "../../plugin/plugin-session.ts";

/** The designer's notes on the canvas within `distance` px of the screen holding the layer. */
export async function nearbyNotes(
  session: PluginSession,
  node: string,
  distance: number,
): Promise<OperationOutput<"nearby">> {
  try {
    return await session.run("nearby", {
      node,
      distance,
    });
  } catch (error) {
    // A plugin of an earlier release does not know the operation: the server updates on its own, the plugin does not.
    if (error instanceof BridgeError && error.code === "UNKNOWN_OP") {
      throw new BridgeError(
        "UNKNOWN_OP",
        "The Pixelwright plugin in this file is older than the server and cannot read the notes around a screen: run npx -y pixelwright@latest to update it, or read without nearby.",
      );
    }

    throw error;
  }
}
