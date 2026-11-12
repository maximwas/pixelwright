import type { InstancesOutput } from "@pixelwright/core";
import { ownerOf } from "../../figma/variants.ts";
import { type Carry, carriesOf, carry } from "./carry.ts";

type Reattached = InstancesOutput["reattached"][number];

/** How the answer names what a frame kept: "text Title", "image Photo", "hidden Badge". */
const keptOf = (carries: readonly Carry[]) => carries.map(({ kind, source }) => `${kind} ${source.name}`);

/**
 * A detached frame put back as an instance of its component, where it stood and at its size, with its texts,
 * images and hidden layers by their paths; the frame is removed. A dry run only says what would be kept and lost.
 */
export async function reattachFrame(frame: FrameNode, dryRun: boolean): Promise<Reattached> {
  // A removed node throws on every read: what the answer says of the frame is taken first.
  const { id, name: frameName } = frame;
  const component = await componentOf(frame);
  const owner = ownerOf(component);
  const name = owner === component ? component.name : `${owner.name}, ${component.name}`;

  if (dryRun) {
    const { carries, lost } = carriesOf(frame, component);

    return {
      frame: id,
      name: frameName,
      instance: null,
      component: name,
      kept: keptOf(carries),
      lost,
    };
  }

  const instance = component.createInstance();
  let made: { kept: string[]; lost: string[] };

  try {
    place(instance, frame);

    const { carries, lost } = carriesOf(frame, instance);

    for (const each of carries) {
      await carry(each);
    }

    // Named before the frame goes: a removed layer throws when read.
    made = {
      kept: keptOf(carries),
      lost,
    };
  } catch (error) {
    // Half put back is worse than not at all: the frame stays as it was.
    instance.remove();

    throw error;
  }

  frame.remove();

  return {
    frame: id,
    name: frameName,
    instance: instance.id,
    component: name,
    ...made,
  };
}

/** The component Figma remembers the frame was detached from: the file's own, or a library's brought in. */
async function componentOf(frame: FrameNode): Promise<ComponentNode> {
  const info = frame.detachedInfo;

  if (info?.type === "library") {
    return await figma.importComponentByKeyAsync(info.componentKey).catch(() => {
      throw new Error(
        `${frame.name} was detached from a library component Figma cannot bring in now: enable its library, or check that Figma is online.`,
      );
    });
  }

  const node = info === null ? null : await figma.getNodeByIdAsync(info.componentId);

  if (node?.type !== "COMPONENT") {
    throw new Error(`${frame.name} was detached from a component that is no longer in this file.`);
  }

  return node;
}

/** The instance where the frame stands: its place among its parent's children, its position, size and sizing. */
function place(instance: InstanceNode, frame: FrameNode): void {
  const parent = frame.parent as (BaseNode & ChildrenMixin) | null;
  const flows = parent !== null && "layoutMode" in parent && parent.layoutMode !== "NONE";

  parent?.insertChild(parent.children.indexOf(frame), instance);
  instance.name = frame.name;

  if (flows && frame.layoutPositioning === "ABSOLUTE") {
    instance.layoutPositioning = "ABSOLUTE";
  }

  if (!flows || frame.layoutPositioning === "ABSOLUTE") {
    instance.x = frame.x;
    instance.y = frame.y;
    instance.constraints = frame.constraints;
  }

  if (instance.width !== frame.width || instance.height !== frame.height) {
    instance.resize(frame.width, frame.height);
  }

  for (const axis of ["layoutSizingHorizontal", "layoutSizingVertical"] as const) {
    try {
      instance[axis] = frame[axis];
    } catch {
      // A sizing the instance cannot take (hug without auto layout, fill outside one): its own stays.
    }
  }
}
