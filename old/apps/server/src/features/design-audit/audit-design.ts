import { type DesignAudit, designAudit } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { selectedLayer } from "../../plugin/selected-layer.ts";
import type { AuditInputSchema } from "./schemas.ts";

/** The scale a layer uses (the selected layer by default), and what is off it. */
export async function auditDesign(
  plugin: PluginClient,
  { node, file }: z.output<typeof AuditInputSchema>,
): Promise<DesignAudit> {
  const session = plugin.session(file);
  const id = node ?? (await selectedLayer(session));

  return designAudit(
    await session.run("snapshot", {
      node: id,
      css: "none",
    }),
  );
}
