import { type InspectViewSchema, inspectView } from "@pixelwright/core";
import type * as z from "zod";
import { MAX_INSPECTED } from "../../constants/mcp.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { InspectInputSchema } from "./schemas.ts";

type InspectArgs = z.output<typeof InspectInputSchema>;

/** The layers named, else the selection, inspected by the plugin and put into words by core. */
export async function inspectLayers(
  plugin: PluginClient,
  { nodes, relativeTo, file }: InspectArgs,
): Promise<z.output<typeof InspectViewSchema>> {
  const session = plugin.session(file);
  const ids = nodes ?? (await session.run("selection", null)).nodes.map((node) => node.id);

  if (ids.length === 0) {
    throw new Error("Nothing is selected in Figma: select the layers to inspect, or give their ids in nodes.");
  }

  const raw = await session.run("inspect", {
    nodes: ids.slice(0, MAX_INSPECTED),
    ...(relativeTo === undefined ? {} : { relativeTo }),
  });

  const view = inspectView(raw);

  return ids.length > MAX_INSPECTED
    ? {
        ...view,
        left: ids.length - MAX_INSPECTED,
      }
    : view;
}
