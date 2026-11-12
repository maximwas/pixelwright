import { countOutline, outlineXml } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { OutlineInputSchema } from "./schemas.ts";

/** The layer tree the plugin outlines, as XML, with how many layers it lists. */
export async function readOutline(
  plugin: PluginClient,
  { file, ...query }: z.output<typeof OutlineInputSchema>,
): Promise<{ xml: string; nodes: number }> {
  const { root } = await plugin.run("outline", query, file);

  return {
    xml: outlineXml(root),
    nodes: countOutline(root),
  };
}
