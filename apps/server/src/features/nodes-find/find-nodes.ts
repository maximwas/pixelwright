import type { OperationResult } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { scopeOf } from "../../plugin/scope.ts";
import type { NodesFindInputSchema } from "./schemas.ts";

type Input = Omit<z.output<typeof NodesFindInputSchema>, "file"> & { file?: string };

/** nodes_find: the plugin's find on the current page or inside `within`; for "file", page after page up to the limit. */
export async function findNodes(
  plugin: PluginClient,
  { file, within, ...query }: Input,
): Promise<OperationResult<"find">> {
  const session = plugin.session(file);

  if (within !== "file") {
    return await session.run(
      "find",
      within === undefined
        ? query
        : {
            ...query,
            within,
          },
    );
  }

  const { pages } = await scopeOf(session, within, { pageWhenEmpty: true });
  const nodes: OperationResult<"find">["nodes"] = [];

  for (const page of pages) {
    const found = await session.run("find", {
      ...query,
      within: page,
    });

    nodes.push(...found.nodes);

    if (found.more || nodes.length > query.limit) {
      return {
        nodes: nodes.slice(0, query.limit),
        more: true,
      };
    }
  }

  return {
    nodes,
    more: false,
  };
}
