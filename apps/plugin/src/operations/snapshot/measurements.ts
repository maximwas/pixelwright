import type { OperationOutput } from "@pixelwright/core";
import { pageOf } from "../../figma/nodes.ts";

type Measurements = NonNullable<OperationOutput<"snapshot">["measurements"]>;

/** The page's Dev Mode measurements with a side on the layer or inside it; none where Figma has no such API. */
export function measurementsOf(root: SceneNode): Measurements {
  const page = pageOf(root) as (PageNode & Partial<MeasurementsMixin>) | null;
  let measurements: Measurement[];

  try {
    measurements = page?.getMeasurements?.() ?? [];
  } catch {
    // The typings call measurements Dev Mode only: a Figma that refuses them reads without.
    return [];
  }

  return measurements.flatMap(({ start, end, freeText }) =>
    within(start.node, root) || within(end.node, root)
      ? [
          {
            start: {
              id: start.node.id,
              side: start.side,
            },
            end: {
              id: end.node.id,
              side: end.side,
            },
            ...(freeText === "" ? {} : { text: freeText }),
          },
        ]
      : [],
  );
}

/** Whether a layer is the root or inside it. */
function within(node: BaseNode, root: SceneNode): boolean {
  for (let current: BaseNode | null = node; current !== null; current = current.parent) {
    if (current.id === root.id) {
      return true;
    }
  }

  return false;
}
