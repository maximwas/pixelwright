import { BridgeError } from "@pixelwright/core";
import type { PluginClient } from "../plugin/plugin-client.ts";
import { errorMessage } from "../utils/error-message.ts";

/**
 * The named version a write saves in the file's history first, when it was given a title: none for a dry run. A save
 * that fails stops the write, so a write never goes ahead without the version it was promised.
 */
export async function versionBefore(
  plugin: PluginClient,
  { title, dryRun, file }: { title: string | undefined; dryRun: boolean; file?: string | undefined },
): Promise<{ id: string | null; title: string } | undefined> {
  if (title === undefined || dryRun) {
    return undefined;
  }

  try {
    const { id } = await plugin.run("save_version", { title }, file);

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
