import type { InstancesInput, InstancesOutput } from "@pixelwright/core";
import { OP_BUDGET_MS } from "../../constants/plugin.ts";
import { ComponentIndex } from "../../figma/component-index.ts";
import { requireRoots } from "../../figma/nodes.ts";
import { layersUntil } from "../../figma/walk.ts";
import type { PluginServices } from "../../services/plugin-services.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { reattachFrame } from "./reattach.ts";
import { resetInstance } from "./reset.ts";
import { swapInstance } from "./swap.ts";

/**
 * The `instances` operation under the roots: detached frames put back as instances of their components, instances
 * swapped for another component, instances' overrides taken off. Each layer on its own, its error named while the rest
 * goes on. A dry run writes nothing and works with Allow edits off; a real run is one undo step.
 */
export async function instancesOperation(input: InstancesInput, { edits }: PluginServices): Promise<InstancesOutput> {
  if (!input.dryRun) {
    edits.require();
  }

  const targets = instanceTargets(await requireRoots(input.roots), Date.now() + OP_BUDGET_MS);
  const output: InstancesOutput = {
    reattached: [],
    swapped: [],
    reset: [],
    errors: [],
    notes: [],
    more: !targets.finished,
  };

  await reattach(targets, input, output);
  await swapAndReset(targets, input, output);

  if (!input.dryRun && output.reattached.length + output.swapped.length + output.reset.length > 0) {
    figma.commitUndo();
  }

  return output;
}

/** What an instances call goes through: frames detached from a component, and instances, each outermost. */
interface InstanceTargets {
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
 * The detached frames and instances under the roots (the roots among them), until the deadline. Neither is gone into:
 * a frame inside a detached frame goes with it, and an instance's own instances are its overrides.
 */
function instanceTargets(roots: readonly BaseNode[], deadline: number): InstanceTargets {
  const { layers, finished } = layersUntil(roots, deadline, (node) => node.type !== "INSTANCE" && !isDetached(node));

  return {
    detached: layers.filter(isDetached),
    instances: layers.filter((node): node is InstanceNode => node.type === "INSTANCE"),
    finished,
  };
}

async function reattach(targets: InstanceTargets, input: InstancesInput, output: InstancesOutput): Promise<void> {
  for (const frame of input.reattach ? targets.detached : []) {
    try {
      output.reattached.push(await reattachFrame(frame, input.dryRun));
    } catch (error) {
      output.errors.push({
        id: frame.id,
        message: errorMessage(error),
      });
    }
  }
}

async function swapAndReset(targets: InstanceTargets, input: InstancesInput, output: InstancesOutput): Promise<void> {
  const index = new ComponentIndex();

  for (const instance of input.swap.length > 0 || input.reset !== undefined ? targets.instances : []) {
    try {
      const swapped =
        input.swap.length === 0
          ? null
          : await swapInstance(instance, input.swap, {
              index,
              dryRun: input.dryRun,
            });
      const reset = input.reset === undefined ? null : await resetInstance(instance, input.reset, input.dryRun);

      if (swapped !== null) {
        output.swapped.push(swapped);
      }

      if (reset !== null) {
        output.reset.push(reset);
      }
    } catch (error) {
      output.errors.push({
        id: instance.id,
        message: errorMessage(error),
      });
    }
  }
}
