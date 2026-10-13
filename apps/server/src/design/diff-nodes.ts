import { designDiff, OPERATION_SCHEMAS } from "@pixelwright/core";
import type * as z from "zod";
import { resolveTarget } from "../bridge/target.ts";
import { MAX_DIFF_ENTRIES } from "../constants/mcp.ts";
import type { NodesDiffInputSchema, NodesDiffOutputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

type NodesDiffArgs = z.output<typeof NodesDiffInputSchema>;
type NodesDiff = z.output<typeof NodesDiffOutputSchema>;

/** Both layers read from one file, compared by core, the lists cut to MAX_DIFF_ENTRIES each. */
export async function diffNodes(
  bridge: ToolContext["bridge"],
  { a, b, depth, file }: NodesDiffArgs,
): Promise<NodesDiff> {
  // One file for both reads: the user may switch files in between.
  const target = resolveTarget(bridge.plugins(), file);
  const read = async (node: string) =>
    OPERATION_SCHEMAS.snapshot.output.parse(
      await bridge.request(
        "snapshot",
        {
          node,
          css: "unmapped",
          paths: true,
          ...(depth === undefined ? {} : { depth }),
        },
        target,
      ),
    );
  const left = await read(a);
  const right = await read(b);
  const diff = designDiff(left, right);
  const more =
    Math.max(0, diff.onlyInA.length - MAX_DIFF_ENTRIES) +
    Math.max(0, diff.onlyInB.length - MAX_DIFF_ENTRIES) +
    Math.max(0, diff.changed.length - MAX_DIFF_ENTRIES);
  const named = (id: string, name: string) => `${id} "${name}"`;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return {
    summary: diff.same
      ? `${named(a, left.root.name)} and ${named(b, right.root.name)} read the same.`
      : `${named(a, left.root.name)} and ${named(b, right.root.name)}: ${count(diff.changed.length, "layer differs", "layers differ")}, ${diff.onlyInA.length} only in A, ${diff.onlyInB.length} only in B.`,
    same: diff.same,
    onlyInA: diff.onlyInA.slice(0, MAX_DIFF_ENTRIES),
    onlyInB: diff.onlyInB.slice(0, MAX_DIFF_ENTRIES),
    changed: diff.changed.slice(0, MAX_DIFF_ENTRIES),
    ...(more === 0 ? {} : { more }),
  };
}
