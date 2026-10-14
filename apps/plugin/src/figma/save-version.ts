import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { requireEdits } from "./edits.ts";

/** A named version in the file's history, before a write: it changes the file's history, so it needs Allow edits. */
export async function saveVersion({ title }: OperationInput<"save_version">): Promise<OperationOutput<"save_version">> {
  requireEdits();

  const saved = await figma.saveVersionHistoryAsync(title);

  return { id: saved?.id ?? null };
}
