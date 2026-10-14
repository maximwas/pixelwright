import { type BaselineFile, BridgeError, type OperationResult } from "@pixelwright/core";
import type { PluginSession } from "../plugin/plugin-session.ts";

/** How many look-alikes a missing root's answer names. */
const CANDIDATES = 3;

/** Where a baseline's layer is now: compared, or why it cannot be. */
export type RootNow =
  | {
      readonly status: "found";
      readonly id: string;
      readonly now?: { id: string; name: string };
      readonly notes: string[];
    }
  | { readonly status: "missing" | "unavailable"; readonly reason: string };

/**
 * The layer a baseline is compared with: `node` when given; else its own id; a gone one found again by its exact name
 * and type on its page, when exactly one layer has them. An id that now names a layer of another type and name means
 * another file: unavailable.
 */
export async function locateRoot(
  session: PluginSession,
  baseline: Pick<BaselineFile, "name" | "node" | "page" | "file">,
  node: string | undefined,
): Promise<RootNow> {
  if (node !== undefined) {
    return {
      status: "found",
      id: node,
      notes: [],
    };
  }

  const stored = await layerAt(session, baseline.node.id);

  if (stored === null) {
    return byName(session, baseline);
  }

  if (stored.type !== baseline.node.type && stored.name !== baseline.node.name) {
    return {
      status: "unavailable",
      reason: `${baseline.node.id} in ${baseline.file.name} is a ${stored.type} named ${stored.name}, not the ${baseline.node.type} this baseline holds: is this the right file? Pass node to compare anyway.`,
    };
  }

  return {
    status: "found",
    id: baseline.node.id,
    notes: [],
  };
}

/** The layer at an id, as an outline names it; null when the file has none. */
async function layerAt(session: PluginSession, id: string): Promise<{ name: string; type: string } | null> {
  try {
    const { root } = await session.run("outline", {
      node: id,
      depth: 1,
    });

    return root;
  } catch (error) {
    if (error instanceof BridgeError && error.code === "NODE_NOT_FOUND") {
      return null;
    }

    throw error;
  }
}

/** The one layer on the baseline's page with its root's exact name and type, else missing with the look-alikes. */
async function byName(
  session: PluginSession,
  baseline: Pick<BaselineFile, "name" | "node" | "page">,
): Promise<RootNow> {
  const { nodes } = await session.run("find", {
    name: baseline.node.name,
    type: baseline.node.type,
    ...(baseline.page === null ? {} : { within: baseline.page.id }),
    limit: 50,
  });
  const exact = nodes.filter((found) => found.name === baseline.node.name && found.type === baseline.node.type);
  const [only] = exact;

  if (exact.length === 1 && only !== undefined) {
    return {
      status: "found",
      id: only.id,
      now: {
        id: only.id,
        name: only.name,
      },
      notes: [`${baseline.node.id} is gone: compared with ${only.name} (${only.id}), the one layer of its name.`],
    };
  }

  return {
    status: "missing",
    reason: missingReason(baseline, exact.length === 0 ? nodes : exact),
  };
}

function missingReason(
  baseline: Pick<BaselineFile, "name" | "node">,
  candidates: OperationResult<"find">["nodes"],
): string {
  const named = candidates.slice(0, CANDIDATES).map((found) => `${found.name} (${found.id})`);

  return `${baseline.node.name} (${baseline.node.id}) is gone${named.length === 0 ? "" : `; layers like it: ${named.join(", ")}`}: pass node to compare one, or baseline_save {name: "${baseline.name}", node, replace: true} to start over.`;
}
