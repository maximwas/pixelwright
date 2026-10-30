import { InjectionToken, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LOOKUP_TEXT } from "@/plugin/adapters/figma/lookup/lookup.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** A layer by id: the one place by-id lookups live, since offline each one waits 10 s (P-070, FX-015). */
@injectable()
export class NodeLookup {
  node(id: string): Promise<BaseNode | null> {
    return figma.getNodeByIdAsync(id);
  }

  /** A style by id; null when Figma cannot give it (a library offline, FX-015). */
  style(id: string): Promise<BaseStyle | null> {
    return figma.getStyleByIdAsync(id).catch(() => null);
  }

  /** A variable by id; null when Figma cannot give it. */
  variable(id: string): Promise<Variable | null> {
    return figma.variables.getVariableByIdAsync(id).catch(() => null);
  }

  /** A variable collection by id; null when Figma cannot give it. */
  collection(id: string): Promise<VariableCollection | null> {
    return figma.variables.getVariableCollectionByIdAsync(id).catch(() => null);
  }

  /** An image fill's image by its hash (T-055); null when the file has none. */
  image(hash: string): Image | null {
    return figma.getImageByHash(hash);
  }

  /** The node, or NODE_NOT_FOUND naming the tools that find ids. */
  async existing(id: string): Promise<BaseNode> {
    const found = await this.node(id);

    if (found === null) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, LOOKUP_TEXT.notFound(id));
    }

    return found;
  }

  /** The page a node is on; null for the document and a node off every page. */
  pageOf(node: BaseNode): PageNode | null {
    for (let current: BaseNode | null = node; current !== null; current = current.parent) {
      if (current.type === FIGMA_NODE_TYPE.page) {
        return current;
      }
    }

    return null;
  }
}

export const NODE_LOOKUP = new InjectionToken<NodeLookup>("NodeLookup");
