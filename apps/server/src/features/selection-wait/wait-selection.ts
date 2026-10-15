import { type OperationResult, SELECTION_WAIT_MAX_MS } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { SelectionWaitInputSchema, SelectionWaitOutputSchema } from "./schemas.ts";

/**
 * Waits until the user selects something else, in rounds the bridge allows (a request lives 30 s), each from the
 * selection the first round started with, until `timeout` seconds have passed or the client cancels the call.
 */
export async function waitForSelection(
  plugin: PluginClient,
  { timeout, file }: z.output<typeof SelectionWaitInputSchema>,
  signal?: AbortSignal,
): Promise<z.output<typeof SelectionWaitOutputSchema>> {
  const session = plugin.session(file);
  const deadline = Date.now() + timeout * 1_000;
  let from: string[] | null = null;

  for (;;) {
    const round: OperationResult<"selection_wait"> = await session.run("selection_wait", {
      timeoutMs: Math.max(1, Math.min(SELECTION_WAIT_MAX_MS, deadline - Date.now())),
      from,
    });

    // The client gave up on the call: no more rounds for nobody to read.
    if (round.changed || Date.now() >= deadline || signal?.aborted) {
      return {
        changed: round.changed,
        nodes: round.nodes,
      };
    }

    from = round.from;
  }
}
