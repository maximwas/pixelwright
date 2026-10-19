import type { FigmaProps } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import type { TypedLayer } from "../../../figma/capabilities.ts";
import { ANNOTATION_STEPS } from "./annotation-steps.ts";
import { APPEARANCE_STEPS } from "./appearance-steps.ts";
import { CHILD_STEPS } from "./child-steps.ts";
import { LAYOUT_STEPS } from "./layout-steps.ts";
import { MODE_STEPS } from "./mode-steps.ts";
import { PAINT_STEPS } from "./paint-steps.ts";
import { SIZE_STEPS } from "./size-steps.ts";
import type { Step } from "./step.ts";
import { TRANSFORM_STEPS } from "./transform-steps.ts";

/** The layer itself: its name and whether it shows. */
const ELEMENT_STEPS: readonly Step[] = [
  {
    keys: ["name"],
    write: (node, { name }) => {
      if (name !== undefined) {
        assign(node, "name", name);

        // Named already as given ("Text"), a new text would still take its characters' name: set or not, it keeps it.
        if (node.type === "TEXT") {
          assign(node, "autoRename", false);
        }
      }
    },
  },
  {
    keys: ["visible"],
    write: (node, { visible }) => {
      if (visible !== undefined) {
        assign(node, "visible", visible);
      }
    },
  },
];

/**
 * Every property of a layer, in Figma's order: the layer's own layout before anything sized in it, sizes before
 * placement (an edge pin needs the size), the turn before placement (a turned layer is placed by its centre), then
 * how it looks and what it says. Text comes after, on its own.
 */
export const STEPS: readonly Step[] = [
  ...ELEMENT_STEPS,
  ...LAYOUT_STEPS,
  ...SIZE_STEPS,
  ...CHILD_STEPS,
  ...TRANSFORM_STEPS,
  ...APPEARANCE_STEPS,
  ...PAINT_STEPS,
  ...MODE_STEPS,
  ...ANNOTATION_STEPS,
];

/** The steps a layer's properties run: those naming a property it gives; a text's link is the text writer's. */
export function stepsFor(props: FigmaProps, node: TypedLayer): Step[] {
  return STEPS.filter(
    (step) =>
      step.keys.some((key) => props[key] !== undefined) && !(step.keys[0] === "hyperlink" && node.type === "TEXT"),
  );
}
