/** What an instances call goes through: frames detached from a component, and instances, each outermost. */
export interface InstanceTargets {
  readonly detached: FrameNode[];
  readonly instances: InstanceNode[];
  readonly finished: boolean;
}

/** Whether a layer is a frame Figma remembers detaching from a component. */
function isDetached(node: BaseNode): node is FrameNode {
  return (
    node.type === "FRAME" && (node as FrameNode).detachedInfo !== null && (node as FrameNode).detachedInfo !== undefined
  );
}

/**
 * The detached frames and instances under the roots (the roots among them), depth first, until the deadline. Neither
 * is gone into: a frame inside a detached frame goes with it, and an instance's own instances are its overrides.
 */
export function instanceTargets(roots: readonly BaseNode[], deadline: number): InstanceTargets {
  const detached: FrameNode[] = [];
  const instances: InstanceNode[] = [];
  const stack: BaseNode[] = [...roots].reverse();
  let seen = 0;

  while (stack.length > 0) {
    if (++seen % 200 === 0 && Date.now() > deadline) {
      return {
        detached,
        instances,
        finished: false,
      };
    }

    const node = stack.pop() as BaseNode;

    if (node.type === "INSTANCE") {
      instances.push(node);
    } else if (isDetached(node)) {
      detached.push(node);
    } else if ("children" in node) {
      stack.push(...[...node.children].reverse());
    }
  }

  return {
    detached,
    instances,
    finished: true,
  };
}
