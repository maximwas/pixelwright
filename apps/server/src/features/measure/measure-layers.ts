import { BridgeError, type MeasureSchema, measureLayers } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { MeasureInputSchema } from "./schemas.ts";

type MeasureArgs = z.output<typeof MeasureInputSchema>;

/** The layers named (else the selection), read by the inspect op in page px, measured by core. */
export async function measureNodes(
  plugin: PluginClient,
  { nodes, painted, file }: MeasureArgs,
): Promise<z.output<typeof MeasureSchema>> {
  const session = plugin.session(file);
  const ids = nodes ?? (await session.run("selection", null)).nodes.map((node) => node.id);
  const raw = await session.run("inspect", { nodes: ids.slice(0, 100) });

  if (raw.layers.length < 2) {
    throw new BridgeError(
      "OP_FAILED",
      `Measuring takes two layers or more: ${raw.layers.length === 0 ? "none" : "only one"} of ${ids.join(", ") || "the selection"} ${raw.layers.length === 1 ? "is a layer" : "are layers"} of this file.`,
    );
  }

  return {
    measured: painted ? "painted" : "box",
    ...measureLayers(raw.layers, painted),
    missing: raw.missing,
  };
}
