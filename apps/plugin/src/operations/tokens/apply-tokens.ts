import type { OperationInput, OperationOutput } from "@pixelwright/core";
import type { PluginServices } from "../../services/plugin-services.ts";
import { TokenWriter } from "./writer/token-writer.ts";

/** The `tokens_apply` operation: the plan core made, written by a TokenWriter. */
export async function applyTokens(
  input: OperationInput<"tokens_apply">,
  services: Pick<PluginServices, "edits" | "fonts">,
): Promise<OperationOutput<"tokens_apply">> {
  return await new TokenWriter(input, services).run();
}
