import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { ExecuteInputSchema, ExecuteOutputSchema } from "./schemas.ts";

type ExecuteArgs = z.output<typeof ExecuteInputSchema>;

export async function executeCode(
  plugin: PluginClient,
  { code, timeout, file }: ExecuteArgs,
): Promise<z.input<typeof ExecuteOutputSchema>> {
  return await plugin.run(
    "execute",
    {
      code,
      timeoutMs: Math.round(timeout * 1_000),
    },
    file,
  );
}
