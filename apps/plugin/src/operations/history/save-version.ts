import type { OperationInput, OperationOutput } from "@pixelwright/core";
import type { PluginServices } from "../../services/plugin-services.ts";
import { VERSION_SETTLE_MS } from "./constants.ts";

/**
 * A named version in the file's history, with its description: it changes the file's history, so it needs Allow edits.
 * It waits for Pixelwright's last write to settle first, so the version holds it. The description comes back, so the
 * server knows this plugin passed it on.
 */
export async function saveVersion(
  { title, description }: OperationInput<"save_version">,
  { edits, journal }: Pick<PluginServices, "edits" | "journal">,
): Promise<OperationOutput<"save_version">> {
  edits.require();
  await journal.settled(VERSION_SETTLE_MS);

  const saved = await figma.saveVersionHistoryAsync(title, description);

  return {
    id: saved?.id ?? null,
    ...(description === undefined ? {} : { description }),
  };
}
