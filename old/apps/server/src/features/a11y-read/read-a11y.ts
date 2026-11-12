import { type A11yRead, a11yRead } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { selectedLayer } from "../../plugin/selected-layer.ts";
import type { A11yReadInputSchema } from "./schemas.ts";

/** A screen's accessibility (the selected layer by default), read from its snapshot. */
export async function readA11y(
  plugin: PluginClient,
  { node, file }: z.output<typeof A11yReadInputSchema>,
): Promise<A11yRead> {
  const session = plugin.session(file);
  const id = node ?? (await selectedLayer(session));

  return a11yRead(
    await session.run("snapshot", {
      node: id,
      css: "none",
    }),
  );
}
