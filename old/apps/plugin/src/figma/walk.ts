/**
 * The roots and the layers under them, depth first in document order, each once however the roots nest, until the
 * deadline: Figma's findAll cannot be stopped, and on a big page it can outlast the request. `into` says whether to go
 * into a layer's children (a walk that leaves instances to their components says no to them). `finished` says
 * whether every layer was reached.
 */
export function layersUntil(
  roots: readonly BaseNode[],
  deadline: number,
  into: (node: BaseNode) => boolean = () => true,
): { layers: BaseNode[]; finished: boolean } {
  const layers: BaseNode[] = [];
  const seen = new Set<string>();
  const stack: BaseNode[] = [...roots].reverse();

  while (stack.length > 0) {
    if (layers.length % 500 === 0 && Date.now() > deadline) {
      return {
        layers,
        finished: false,
      };
    }

    const node = stack.pop() as BaseNode;

    if (seen.has(node.id)) {
      continue;
    }

    seen.add(node.id);
    layers.push(node);

    if ("children" in node && into(node)) {
      for (let index = node.children.length - 1; index >= 0; index--) {
        stack.push(node.children[index] as BaseNode);
      }
    }
  }

  return {
    layers,
    finished: true,
  };
}
