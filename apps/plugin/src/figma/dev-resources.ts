import pTimeout from "p-timeout";
import { LINKS_TIMEOUT_MS } from "../constants/plugin.ts";
import { errorMessage } from "../utils/error-message.ts";

/** Figma's servers gave no answer about a node's links in LINKS_TIMEOUT_MS. */
export class LinksTimeout extends Error {}

/** Whether this Figma has dev resources at all: an older one, or the tests' fake, reads no links. */
export function hasDevResources(): boolean {
  return typeof (figma.root as Partial<DocumentNode>).getDevResourcesAsync === "function";
}

/**
 * Why the file gives no links: Figma's own words when it refuses them (a plan without Dev Mode answers 403), null when
 * it answers. Asked without includeChildren on purpose: a refusing file answers that one with [] and no error.
 */
export async function linksRefusal(): Promise<string | null> {
  try {
    await answered(figma.root.getDevResourcesAsync());

    return null;
  } catch (error) {
    if (error instanceof LinksTimeout) {
      throw error;
    }

    return errorMessage(error);
  }
}

/** A node's links, its descendants' too with includeChildren; LinksTimeout when Figma's servers do not answer. */
export function devResourcesOf(node: BaseNode, includeChildren = false): Promise<DevResourceWithNodeId[]> {
  return answered(node.getDevResourcesAsync(includeChildren ? { includeChildren } : undefined));
}

/** A call to Figma's servers, given up on after LINKS_TIMEOUT_MS. */
function answered<T>(call: Promise<T>): Promise<T> {
  return pTimeout(call, {
    milliseconds: LINKS_TIMEOUT_MS,
    message: new LinksTimeout(),
  });
}
