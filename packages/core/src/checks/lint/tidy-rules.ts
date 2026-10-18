import { DEFAULT_NAME } from "../../design/hints/layer-hints.ts";
import { LOOK_OVERRIDES } from "../../instances/look-overrides.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { findingOf, type LintRule } from "./lint-rule.ts";

/** Frames detached from their component: every change to the component passes them by. */
export const DETACHED: LintRule = {
  id: "detached",
  severity: "warning",
  about: "Frames detached from a component.",
  check: ({ node }) =>
    node.detached
      ? [
          findingOf(DETACHED, node, {
            message: "Detached from its component: changes to the component pass it by.",
            fix: "instances_reattach puts an instance of the component back in its place.",
          }),
        ]
      : [],
};

/** Layers of instances whose look differs from their component outside its properties. */
export const OVERRIDDEN: LintRule = {
  id: "overridden",
  severity: "info",
  about: "Instance layers that change their component's look (fills, radii, fonts) outside its properties.",
  check: ({ node }) => {
    const words = [...new Set((node.overrides ?? []).flatMap((field) => LOOK_OVERRIDES[field] ?? []))];

    return words.length === 0
      ? []
      : [
          findingOf(OVERRIDDEN, node, {
            message: `Overrides its component's ${words.join(", ")}.`,
            fix: "Make it a property or a variant of the component, or take the overrides off (instances_reattach reset).",
          }),
        ];
  },
};

/** Layers left with the names Figma gave them. */
export const DEFAULT_NAMES: LintRule = {
  id: "default-name",
  severity: "info",
  about: "Layers keeping Figma's default names (Frame 427).",
  check: ({ node, inInstance }) =>
    !inInstance && DEFAULT_NAME.test(node.name)
      ? [
          findingOf(DEFAULT_NAMES, node, {
            message: "Keeps Figma's default name.",
            fix: "Name it by its role in the code (design_apply name=).",
          }),
        ]
      : [],
};

/** Whether a layer draws nothing: no visible paint, stroke or effect. */
function drawsNothing(node: SnapshotNode): boolean {
  const shows = (paints: SnapshotNode["fills"] | SnapshotNode["strokes"]) =>
    paints === "mixed" || (paints ?? []).some((paint) => paint.visible ?? true);

  return !shows(node.fills) && !shows(node.strokes) && !(node.effects ?? []).some((effect) => effect.visible ?? true);
}

/** Hidden layers outside components and empty frames: what the file keeps and the build should not. */
export const LEFTOVER: LintRule = {
  id: "leftover",
  severity: "info",
  hidden: true,
  about: "Hidden layers outside components, and empty frames or groups that draw nothing.",
  check: ({ node, parent, inInstance, inComponent }) => {
    if (parent === null || inInstance || inComponent) {
      return [];
    }

    if (!node.visible) {
      return [
        findingOf(LEFTOVER, node, {
          message: "Hidden.",
          fix: "nodes_delete removes it, unless a prototype or a state shows it.",
        }),
      ];
    }

    const empty = (node.type === "FRAME" || node.type === "GROUP") && node.childCount === 0 && drawsNothing(node);

    return empty
      ? [
          findingOf(LEFTOVER, node, {
            message: `An empty ${node.type.toLowerCase()} that draws nothing.`,
            fix: "nodes_delete removes it, unless it holds space on purpose (then a gap or padding says so).",
          }),
        ]
      : [];
  },
};
