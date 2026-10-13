import type { MeasurementView } from "../types/measure.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The designer's Dev Mode measurements in a read: each end as "<id> <side>", and the distance between the two sides
 * from the read's boxes (a rotated layer's bounding box) when both layers are in it.
 */
export function designMeasurements(snapshot: Snapshot): MeasurementView[] {
  const boxes = new Map<string, SnapshotNode>();
  const walk = (node: SnapshotNode) => {
    boxes.set(node.id, node);
    node.children?.forEach(walk);
  };

  walk(snapshot.root);

  return (snapshot.measurements ?? []).map(({ start, end, text }) => {
    const from = sideOf(boxes.get(start.id), start.side);
    const to = sideOf(boxes.get(end.id), end.side);

    return {
      from: `${start.id} ${start.side.toLowerCase()}`,
      to: `${end.id} ${end.side.toLowerCase()}`,
      ...(from === null || to === null ? {} : { px: round(Math.abs(to - from)) }),
      ...(text === undefined ? {} : { text }),
    };
  });
}

/** Where a layer's side is in the read's frame: x for left and right, y for top and bottom. */
function sideOf(node: SnapshotNode | undefined, side: string): number | null {
  if (node === undefined) {
    return null;
  }

  const { x, y, width, height } = node.bounds ?? node;

  switch (side) {
    case "LEFT":
      return x;
    case "RIGHT":
      return x + width;
    case "TOP":
      return y;
    case "BOTTOM":
      return y + height;
    default:
      return null;
  }
}
