import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { requireNode } from "../../figma/nodes.ts";
import { libraryCatalogue } from "../../figma/tokens/libraries.ts";
import { RawTokensBuilder } from "../../figma/tokens/raw-tokens-builder.ts";

/**
 * The `variables` operation: the file's tokens as Figma keeps them, with the styles and variables the layers in
 * `within` (or the current page) use when asked, and the enabled libraries' variables by name when asked.
 */
export async function readTokens({
  libraries,
  used,
  within,
}: OperationInput<"variables">): Promise<OperationOutput<"variables">> {
  const builder = await RawTokensBuilder.local();

  if (used) {
    await builder.addUsed(within === undefined ? figma.currentPage : await requireNode(within));
  }

  return {
    ...builder.build(),
    ...(libraries ? await libraryCatalogue() : {}),
  };
}
