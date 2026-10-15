import { type Contrast, contrastCheck } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { selectedLayer } from "../../plugin/selected-layer.ts";
import type { ContrastInputSchema } from "./schemas.ts";

/** The texts under a layer (the one selected when none is named) rated for contrast against what is behind them. */
export async function checkContrast(
  plugin: PluginClient,
  { node, file }: z.output<typeof ContrastInputSchema>,
): Promise<Contrast> {
  const session = plugin.session(file);
  const id = node ?? (await selectedLayer(session));

  return contrastCheck(
    await session.run("snapshot", {
      node: id,
      css: "none",
    }),
  );
}
