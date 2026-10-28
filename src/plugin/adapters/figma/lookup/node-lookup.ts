import { InjectionToken, injectable } from "@needle-di/core";

/** A layer by id: the one place by-id lookups live, since offline each one waits 10 s (P-070, FX-015). */
@injectable()
export class NodeLookup {
  node(id: string): Promise<BaseNode | null> {
    return figma.getNodeByIdAsync(id);
  }
}

export const NODE_LOOKUP = new InjectionToken<NodeLookup>("NodeLookup");
