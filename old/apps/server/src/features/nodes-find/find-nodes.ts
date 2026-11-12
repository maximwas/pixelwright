import { BridgeError, type OperationResult } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { scopeOf } from "../../plugin/scope.ts";
import type { NodesFindInputSchema } from "./schemas.ts";

type Input = Omit<z.output<typeof NodesFindInputSchema>, "file"> & { file?: string };
type Query = Omit<Input, "file" | "within">;
type Found = OperationResult<"find">;

/**
 * nodes_find: the plugin's find on the current page or inside `within`; for "file", page after page up to the limit,
 * or through every page when counting, the counts added up.
 */
export async function findNodes(plugin: PluginClient, { file, within, ...query }: Input): Promise<Found> {
  const session = plugin.session(file);

  if (within !== "file") {
    return checked(
      query,
      await session.run(
        "find",
        within === undefined
          ? query
          : {
              ...query,
              within,
            },
      ),
    );
  }

  const { pages } = await scopeOf(session, within, { pageWhenEmpty: true });
  const answers: Found[] = [];

  for (const page of pages) {
    const found = checked(
      query,
      await session.run("find", {
        ...query,
        within: page,
      }),
    );

    answers.push(found);

    if (!query.counts && (found.more || answers.flatMap(({ nodes }) => nodes).length > query.limit)) {
      break;
    }
  }

  return merged(answers, query);
}

/**
 * The plugin's answer, refused when it left out what was asked: a plugin older than the server ignores a variant
 * filter (and would list every variant's instances) and counts nothing.
 */
function checked(query: Query, found: Found): Found {
  if ((query.variant !== undefined && found.variant === undefined) || (query.counts && found.counts === undefined)) {
    throw new BridgeError(
      "OP_FAILED",
      "The Pixelwright plugin in this file is older than the server: it cannot find instances by variant or count them. Update it (npx -y pixelwright@latest), then run the plugin again.",
    );
  }

  return found;
}

/** Every page's answer as one: the first layers up to the limit, and the counts added up in the order first met. */
function merged(answers: readonly Found[], query: Query): Found {
  const nodes = answers.flatMap((found) => found.nodes);
  const counts = new Map<string, NonNullable<Found["counts"]>[number]>();

  for (const entry of answers.flatMap((found) => found.counts ?? [])) {
    const key = `${entry.component}\n${entry.variant ?? ""}`;

    counts.set(key, {
      ...entry,
      count: (counts.get(key)?.count ?? 0) + entry.count,
    });
  }

  return {
    nodes: nodes.slice(0, query.limit),
    more: nodes.length > query.limit || answers.some((found) => found.more),
    ...(answers[0]?.variant === undefined ? {} : { variant: answers[0].variant }),
    ...(query.counts ? { counts: [...counts.values()] } : {}),
    ...(answers.some((found) => found.countsCut) ? { countsCut: true as const } : {}),
  };
}
