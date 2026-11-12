import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { colorProfile } from "../../figma/color-profile.ts";
import { nearestDevStatus } from "../../figma/dev-status.ts";
import { InstanceOverrides } from "../../figma/instance-overrides.ts";
import { annotationCategories } from "../../figma/layer-read/fields/notes.ts";
import { entryOf } from "../../figma/layer-read/read-layer.ts";
import { References } from "../../figma/layer-read/references.ts";
import { isLayer, pageOf, requireNode } from "../../figma/nodes.ts";
import { type ModedNode, rootModes } from "../../figma/variable-modes.ts";
import { ancestorsOf } from "./ancestors.ts";
import { measurementsOf } from "./measurements.ts";
import { readSubtree, SnapshotBudget } from "./subtree.ts";

/**
 * The raw Figma properties of a layer and its descendants, for core to turn into CSS. Built breadth first under a
 * size budget, like outline: a layer whose children did not fit keeps their count. Hidden layers are a name and a box.
 * Asked for, the layers above it too, with what overlaps it in them.
 */
export async function snapshot({
  node: id,
  depth,
  css,
  paths,
  ancestors,
}: OperationInput<"snapshot">): Promise<OperationOutput<"snapshot">> {
  const root = await requireNode(id);

  if (!isLayer(root)) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is a ${root.type.toLowerCase()}: read a layer on a page.`);
  }

  const [[, , originX], [, , originY]] = root.absoluteTransform;
  const references = new References();
  const categories = await annotationCategories();
  const overrides = InstanceOverrides.around(root);
  const budget = new SnapshotBudget();
  const read = (node: SceneNode) =>
    entryOf(node, {
      x: originX ?? 0,
      y: originY ?? 0,
      css,
      paths,
      references,
      categories,
      overrides,
      inferred: true,
    });
  const top = await readSubtree(root, budget, {
    depth,
    read,
  });
  const modes = await rootModes(root as ModedNode, references.lookup);

  if (modes.length > 0) {
    top.modes = modes;
  }

  return {
    root: top,
    ...(ancestors ? { ancestors: await ancestorsOf(root, budget, read) } : {}),
    ...(await aroundRoot(root, references)),
  };
}

/** What a snapshot says besides its layers: Dev Mode marks, the colour profile, the tokens used, the page. */
async function aroundRoot(root: SceneNode, references: References): Promise<Omit<OperationOutput<"snapshot">, "root">> {
  const measurements = measurementsOf(root);
  const devStatus = nearestDevStatus(root);
  const page = pageOf(root);

  return {
    ...(devStatus === undefined ? {} : { devStatus }),
    ...colorProfile(),
    styles: await references.styles([page]),
    variables: await references.variables(),
    ...(measurements.length === 0 ? {} : { measurements }),
    ...(page === null
      ? {}
      : {
          page: {
            id: page.id,
            name: page.name,
          },
        }),
  };
}
