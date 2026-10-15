import { type VariantsView, variantsView } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { VariantsInputSchema } from "./schemas.ts";

/** The component set of a set, variant or instance, read whole on one file, its variants against the default. */
export async function readVariants(
  plugin: PluginClient,
  { node, file }: z.output<typeof VariantsInputSchema>,
): Promise<VariantsView> {
  const session = plugin.session(file);
  const set = await session.run("set_of", { node });
  const snapshot = await session.run("snapshot", {
    node: set.id,
    css: "unmapped",
    paths: true,
  });

  return variantsView(snapshot);
}
