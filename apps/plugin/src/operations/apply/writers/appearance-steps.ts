import type { FigmaProps, LengthValue } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { hasAutoLayout, hasCornerSides, hasCorners, isBlended, refusal } from "../../../figma/capabilities.ts";
import { guarded, type Step, writeLength } from "./step.ts";
import type { WriteScope } from "./write-scope.ts";

const CORNERS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

/** How the layer shows: its opacity, whether it clips what it holds, its corners. */
export const APPEARANCE_STEPS: readonly Step[] = [
  {
    keys: ["opacity"],
    write: guarded(isBlended, "opacity", (node, { opacity }) => {
      if (opacity !== undefined) {
        assign(node, "opacity", opacity);
      }
    }),
  },
  {
    keys: ["clipsContent"],
    write: guarded(hasAutoLayout, "clipping", (node, { clipsContent }) => {
      if (clipsContent !== undefined) {
        assign(node, "clipsContent", clipsContent);
      }
    }),
  },
  {
    keys: ["cornerRadius"],
    write: radius,
  },
];

async function radius(node: SceneNode, { cornerRadius }: FigmaProps, scope: WriteScope): Promise<void> {
  if (Array.isArray(cornerRadius)) {
    if (!hasCornerSides(node)) {
      throw refusal(node, "radius per corner");
    }

    for (const [index, field] of CORNERS.entries()) {
      await writeLength(node, field, cornerRadius[index] ?? 0, scope);
    }
  } else if (cornerRadius !== undefined) {
    if (!hasCorners(node)) {
      throw refusal(node, "corner radius");
    }

    await writeLength(node, "cornerRadius", cornerRadius as LengthValue, scope);
  }
}
