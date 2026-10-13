import { OPERATION_SCHEMAS, type VariantsView, variantsView } from "@pixelwright/core";
import type * as z from "zod";
import { resolveTarget } from "../bridge/target.ts";
import type { VariantsInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

/** The component set of a set, variant or instance, read whole on one file, its variants against the default. */
export async function readVariants(
  bridge: ToolContext["bridge"],
  { node, file }: z.output<typeof VariantsInputSchema>,
): Promise<VariantsView> {
  const target = resolveTarget(bridge.plugins(), file);
  const set = OPERATION_SCHEMAS.set_of.output.parse(await bridge.request("set_of", { node }, target));
  const snapshot = OPERATION_SCHEMAS.snapshot.output.parse(
    await bridge.request(
      "snapshot",
      {
        node: set.id,
        css: "unmapped",
        paths: true,
      },
      target,
    ),
  );

  return variantsView(snapshot);
}
