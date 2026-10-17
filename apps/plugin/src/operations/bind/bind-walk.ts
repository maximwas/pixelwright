import { isLayer } from "../../figma/nodes.ts";

/** The layers a bind call goes through, the instances it left to their components, and whether it reached them all. */
export interface BindLayers {
  readonly layers: SceneNode[];
  readonly instances: number;
  readonly finished: boolean;
}

/**
 * The layers under the roots (and the roots, when they are layers), depth first, until the deadline. An instance is
 * passed over with its layers: what binds there belongs to its main component, and an instance's own would be overrides.
 */
export function bindableLayers(roots: readonly BaseNode[], deadline: number): BindLayers {
  const layers: SceneNode[] = [];
  const stack: BaseNode[] = [...roots].reverse();
  let instances = 0;

  while (stack.length > 0) {
    if (layers.length % 200 === 0 && Date.now() > deadline) {
      return {
        layers,
        instances,
        finished: false,
      };
    }

    const node = stack.pop() as BaseNode;

    if (node.type === "INSTANCE") {
      instances += 1;
      continue;
    }

    if (isLayer(node)) {
      layers.push(node);
    }

    if ("children" in node) {
      stack.push(...[...node.children].reverse());
    }
  }

  return {
    layers,
    instances,
    finished: true,
  };
}
