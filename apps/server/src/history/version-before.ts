import { BridgeError } from "@pixelwright/core";
import { runOp } from "../mcp/run-op.ts";
import type { ToolContext } from "../types/mcp.ts";
import { errorMessage } from "../utils/error-message.ts";

/**
 * The named version a write saves in the file's history first, when it was given a title: none for a dry run. A save
 * that fails stops the write, so a write never goes ahead without the version it was promised.
 */
export async function versionBefore(
  bridge: ToolContext["bridge"],
  { title, dryRun, file }: { title: string | undefined; dryRun: boolean; file?: string | undefined },
): Promise<{ id: string | null; title: string } | undefined> {
  if (title === undefined || dryRun) {
    return undefined;
  }

  try {
    const { id } = await runOp(bridge, "save_version", { title }, file);

    return {
      id,
      title,
    };
  } catch (error) {
    throw new BridgeError(
      error instanceof BridgeError ? error.code : "OP_FAILED",
      `The version "${title}" could not be saved, so nothing was written: ${errorMessage(error)}`,
    );
  }
}
