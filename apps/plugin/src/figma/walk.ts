/**
 * A root and the layers under it, depth first in document order, until the deadline: Figma's findAll cannot be
 * stopped, and on a big page it can outlast the request. `finished` says whether every layer was reached.
 */
export function layersUntil(root: BaseNode, deadline: number): { layers: BaseNode[]; finished: boolean } {
  const layers: BaseNode[] = [];
  const stack: BaseNode[] = [root];

  while (stack.length > 0) {
    if (layers.length % 500 === 0 && Date.now() > deadline) {
      return {
        layers,
        finished: false,
      };
    }

    const node = stack.pop() as BaseNode;

    layers.push(node);

    if ("children" in node) {
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
