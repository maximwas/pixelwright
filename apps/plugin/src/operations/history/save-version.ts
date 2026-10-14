import type { OperationInput, OperationOutput } from "@pixelwright/core";
import type { EditsGuard } from "../../services/edits-guard.ts";

/** A named version in the file's history, before a write: it changes the file's history, so it needs Allow edits. */
export async function saveVersion(
  { title }: OperationInput<"save_version">,
  edits: EditsGuard,
): Promise<OperationOutput<"save_version">> {
  edits.require();

  const saved = await figma.saveVersionHistoryAsync(title);

  return { id: saved?.id ?? null };
}
