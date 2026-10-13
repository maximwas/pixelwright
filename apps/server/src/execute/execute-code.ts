import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import type { ExecuteInputSchema, ExecuteOutputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

type ExecuteArgs = z.output<typeof ExecuteInputSchema>;

export async function executeCode(
  bridge: ToolContext["bridge"],
  { code, timeout, file }: ExecuteArgs,
): Promise<z.input<typeof ExecuteOutputSchema>> {
  return await runOp(
    bridge,
    "execute",
    {
      code,
      timeoutMs: Math.round(timeout * 1_000),
    },
    file,
  );
}
