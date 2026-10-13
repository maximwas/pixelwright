import { type Contrast, contrastCheck } from "@pixelwright/core";
import type * as z from "zod";
import { runOp } from "../mcp/run-op.ts";
import { selectedLayer } from "../mcp/selected-layer.ts";
import type { ContrastInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

/** The texts under a layer (the one selected when none is named) rated for contrast against what is behind them. */
export async function checkContrast(
  bridge: ToolContext["bridge"],
  { node, file }: z.output<typeof ContrastInputSchema>,
): Promise<Contrast> {
  const id = node ?? (await selectedLayer(bridge, file));

  return contrastCheck(
    await runOp(
      bridge,
      "snapshot",
      {
        node: id,
        css: "none",
      },
      file,
    ),
  );
}
