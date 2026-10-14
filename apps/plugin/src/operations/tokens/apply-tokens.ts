import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { TokenWriter } from "./writer/token-writer.ts";

/** The `tokens_apply` operation: the plan core made, written by a TokenWriter. */
export async function applyTokens(input: OperationInput<"tokens_apply">): Promise<OperationOutput<"tokens_apply">> {
  return await new TokenWriter(input).run();
}
