import { BridgeError } from "@pixelwright/core";
import type { PluginSession } from "../plugin/plugin-session.ts";
import { errorMessage } from "../utils/error-message.ts";

/**
 * The named version a write saves in the file's history first, when it was given a title: none for a dry run. A save
 * that fails stops the write, so a write never goes ahead without the version it was promised.
 */
export async function versionBefore(
  session: PluginSession,
  { title, dryRun }: { title: string | undefined; dryRun: boolean },
): Promise<{ id: string | null; title: string } | undefined> {
  if (title === undefined || dryRun) {
    return undefined;
  }

  try {
    const { id } = await session.run("save_version", { title });

    return {
      id,
      title,
    };
  } catch (error) {
    // A plugin of an earlier release does not know the operation: the server updates on its own, the plugin does not.
    if (error instanceof BridgeError && error.code === "UNKNOWN_OP") {
      throw new BridgeError(
        "UNKNOWN_OP",
        "The Pixelwright plugin in this file is older than the server and cannot save versions: run npx -y pixelwright@latest to update it, or write without version.",
      );
    }

    throw new BridgeError(
      error instanceof BridgeError ? error.code : "OP_FAILED",
      `The version "${title}" could not be saved, so nothing was written: ${errorMessage(error)}`,
    );
  }
}
