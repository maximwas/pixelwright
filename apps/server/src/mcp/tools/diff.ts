import type { McpServer } from "@modelcontextprotocol/server";
import { designDiff, OPERATION_SCHEMAS } from "@pixelwright/core";
import type * as z from "zod";
import { resolveTarget } from "../../bridge/target.ts";
import { MAX_DIFF_ENTRIES, READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { NodesDiffInputSchema, NodesDiffOutputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

type NodesDiffArgs = z.output<typeof NodesDiffInputSchema>;
type NodesDiff = z.output<typeof NodesDiffOutputSchema>;

export function registerDiffTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "nodes_diff",
    title: "Compare two layers",
    description:
      "Compares two layers (A/B variants of a screen, a card and its copy) as design_read reads them: layers are matched by their path of names below each root (same-named siblings in order), and the answer lists the layers only A or only B has, and for each layer both have, the attributes that differ as [A's, B's] (text as $text, an instance's variant and props too) and whether an icon's or image's own drawing differs (paths, colours, inner layers). Ids and the two roots' own names and places are left out. Works while Allow edits is off.",
    input: NodesDiffInputSchema,
    output: NodesDiffOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => diffNodes(bridge, args),
  });
}

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
