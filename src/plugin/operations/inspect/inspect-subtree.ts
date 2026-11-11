import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { INSPECT_LAYOUT } from "@/plugin/operations/inspect/inspect.constants.ts";
import { INSPECT, INSPECT_GROUP } from "@/shared/ops/inspect/inspect.constants.ts";

type Group = (typeof INSPECT_GROUP)[keyof typeof INSPECT_GROUP];

/** The layers a subtree read lists, and whether the scan stopped at its bound before the end. */
export interface Selected {
  readonly nodes: SceneNode[];
  readonly cut: boolean;
}

/**
 * The layers of a subtree inspect lists (RG-3), in document order: the root and what is under it down to `depth`
 * levels, and with groups only the visible layers that carry at least one (a hidden layer reads as a stub). The check
 * is a property of the layer, so a page of thousands is scanned without reading any of them.
 */
export class InspectSubtree {
  select(
    root: SceneNode,
    depth: number | undefined,
    groups: readonly Group[] | undefined,
  ): Selected {
    const nodes: SceneNode[] = [];
    const stack: { node: SceneNode; level: number }[] = [{ node: root, level: 0 }];
    let scanned = 0;

    for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
      if (scanned >= INSPECT.maxScan) {
        return { nodes, cut: true };
      }

      scanned += 1;

      if (groups === undefined || (item.node.visible && groups.some((group) => this.#carries(item.node, group)))) {
        nodes.push(item.node);
      }

      if ("children" in item.node && (depth === undefined || item.level < depth)) {
        for (const child of [...item.node.children].reverse()) {
          stack.push({ node: child, level: item.level + 1 });
        }
      }
    }

    return { nodes, cut: false };
  }

  #carries(node: SceneNode, group: Group): boolean {
    switch (group) {
      case INSPECT_GROUP.fills:
        return "fills" in node && (!Array.isArray(node.fills) || node.fills.length > 0);
      case INSPECT_GROUP.strokes:
        return "strokes" in node && node.strokes.length > 0;
      case INSPECT_GROUP.effects:
        return "effects" in node && node.effects.length > 0;
      case INSPECT_GROUP.layout:
        return "layoutMode" in node && node.layoutMode !== INSPECT_LAYOUT.none;
      case INSPECT_GROUP.bound:
        return "boundVariables" in node && Object.keys(node.boundVariables ?? {}).length > 0;
      case INSPECT_GROUP.text:
        return node.type === FIGMA_NODE_TYPE.text;
      case INSPECT_GROUP.component:
        return node.type === FIGMA_NODE_TYPE.instance;
      case INSPECT_GROUP.interactions:
        return "reactions" in node && node.reactions.length > 0;
      default:
        return true;
    }
  }
}
