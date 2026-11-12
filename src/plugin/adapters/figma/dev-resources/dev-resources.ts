import { InjectionToken, injectable } from "@needle-di/core";
import pTimeout, { TimeoutError } from "p-timeout";
import { DEV_LINKS } from "@/plugin/adapters/figma/dev-resources/dev-resources.constants.ts";

/**
 * Dev Mode links (P-087, FX-065): they live on Figma's servers, so each ask is a request that may not come back (a
 * TimeoutError after DEV_LINKS.timeoutMs) or is refused (a plan without Dev Mode answers 403).
 */
@injectable()
export class DevResources {
  /**
   * Why the file gives no links: Figma's own words when it refuses them, null when it answers; a timeout is thrown.
   * Asked without includeChildren on purpose: a refusing file answers that one with [] and no error.
   */
  async refusal(): Promise<string | null> {
    try {
      await this.#answered(figma.root.getDevResourcesAsync());

      return null;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }

      return error instanceof Error ? error.message : String(error);
    }
  }

  /** A node's links, its descendants' too with includeChildren; a TimeoutError when Figma's servers do not answer. */
  of(node: BaseNode, includeChildren: boolean): Promise<DevResourceWithNodeId[]> {
    return this.#answered(node.getDevResourcesAsync(includeChildren ? { includeChildren } : undefined));
  }

  /** No signal for pTimeout: the plugin's main has no DOMException. */
  #answered<Value>(call: Promise<Value>): Promise<Value> {
    return pTimeout(call, { milliseconds: DEV_LINKS.timeoutMs });
  }
}

export const DEV_RESOURCES = new InjectionToken<DevResources>("DevResources");
