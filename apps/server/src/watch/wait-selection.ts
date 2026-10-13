import { OPERATION_SCHEMAS, SELECTION_WAIT_MAX_MS } from "@pixelwright/core";
import type * as z from "zod";
import { resolveTarget } from "../bridge/target.ts";
import type { SelectionWaitInputSchema, SelectionWaitOutputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

/**
 * Waits until the user selects something else, in rounds the bridge allows (a request lives 30 s), each from the
 * selection the first round started with, until `timeout` seconds have passed or the client cancels the call.
 */
export async function waitForSelection(
  bridge: ToolContext["bridge"],
  { timeout, file }: z.output<typeof SelectionWaitInputSchema>,
  signal?: AbortSignal,
): Promise<z.output<typeof SelectionWaitOutputSchema>> {
  const target = resolveTarget(bridge.plugins(), file);
  const deadline = Date.now() + timeout * 1_000;
  let from: string[] | null = null;

  for (;;) {
    const round = OPERATION_SCHEMAS.selection_wait.output.parse(
      await bridge.request(
        "selection_wait",
        {
          timeoutMs: Math.max(1, Math.min(SELECTION_WAIT_MAX_MS, deadline - Date.now())),
          from,
        },
        target,
      ),
    );

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
