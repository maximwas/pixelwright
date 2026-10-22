import { BridgeError, centerOf, type InspectViewSchema, inspectView } from "@pixelwright/core";
import type * as z from "zod";
import { MAX_INSPECTED } from "../../constants/mcp.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import type { InspectInputSchema } from "./schemas.ts";

type InspectArgs = z.output<typeof InspectInputSchema>;
type Origin = { relativeTo?: string };

/**
 * The layers named, else the selection, inspected by the plugin and put into words by core; with `around`, measured
 * from that point, or from the centre of that layer read in the same origin.
 */
export async function inspectLayers(
  plugin: PluginClient,
  { nodes, relativeTo, around, file }: InspectArgs,
): Promise<z.output<typeof InspectViewSchema>> {
  const session = plugin.session(file);
  const ids = nodes ?? (await session.run("selection", null)).nodes.map((node) => node.id);

  if (ids.length === 0) {
    throw new Error("Nothing is selected in Figma: select the layers to inspect, or give their ids in nodes.");
  }

  const origin: Origin = relativeTo === undefined ? {} : { relativeTo };
  const [raw, point] = await Promise.all([
    session.run("inspect", {
      nodes: ids.slice(0, MAX_INSPECTED),
      ...origin,
    }),
    typeof around === "string" ? layerCenter(session, around, origin) : around,
  ]);
  const view = inspectView(raw, point);

  return ids.length > MAX_INSPECTED
    ? {
        ...view,
        left: ids.length - MAX_INSPECTED,
      }
    : view;
}

/** The centre of the layer `around` names, from the origin the boxes are measured from. */
async function layerCenter(session: PluginSession, id: string, origin: Origin): Promise<{ x: number; y: number }> {
  const [layer] = (
    await session.run("inspect", {
      nodes: [id],
      ...origin,
    })
  ).layers;

  if (layer === undefined) {
    throw new BridgeError("NODE_NOT_FOUND", `around: ${id} is not a layer of this file.`);
  }

  return centerOf(layer.box);
}
