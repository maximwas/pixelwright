import { InjectionToken, injectable } from "@needle-di/core";
import { LOOKUP_TEXT } from "@/plugin/adapters/figma/lookup/lookup.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** A layer by id: the one place by-id lookups live, since offline each one waits 10 s (P-070, FX-015). */
@injectable()
export class NodeLookup {
  node(id: string): Promise<BaseNode | null> {
    return figma.getNodeByIdAsync(id);
  }

  /** The node, or NODE_NOT_FOUND naming the tools that find ids. */
  async existing(id: string): Promise<BaseNode> {
    const found = await this.node(id);

    if (found === null) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, LOOKUP_TEXT.notFound(id));
    }

    return found;
  }
}

export const NODE_LOOKUP = new InjectionToken<NodeLookup>("NodeLookup");
