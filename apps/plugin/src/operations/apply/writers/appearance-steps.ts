import type { FigmaProps, LengthValue } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import {
  hasAutoLayout,
  hasCornerSides,
  hasCorners,
  hasEffects,
  hasOpacity,
  refusal,
} from "../../../figma/capabilities.ts";
import { guarded, type Step, writeLength, writeLengths } from "./step.ts";
import type { WriteScope } from "./write-scope.ts";

const CORNERS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

/** Layers whose children blend with what is under them as one, unless their mode says so: CSS's normal for them. */
const PASSING: ReadonlySet<string> = new Set(["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"]);

/** How the layer shows: its opacity, its blend mode, whether it masks or clips, its corners. */
export const APPEARANCE_STEPS: readonly Step[] = [
  {
    keys: ["opacity"],
    ...guarded(hasOpacity, "opacity", (node, { opacity }) => {
      if (opacity !== undefined) {
        assign(node, "opacity", opacity);
      }
    }),
  },
  {
    keys: ["blendMode"],
    ...guarded(hasEffects, "blend mode", (node, { blendMode }) => {
      if (blendMode !== undefined) {
        assign(
          node,
          "blendMode",
          (blendMode === "NORMAL" && PASSING.has(node.type) ? "PASS_THROUGH" : blendMode) as BlendMode,
        );
      }
    }),
  },
  {
    keys: ["mask"],
    ...guarded(hasEffects, "mask", (node, { mask }) => {
      if (mask !== undefined) {
        assign(node, "isMask", mask.isMask);

        if (mask.maskType !== undefined) {
          assign(node, "maskType", mask.maskType);
        }
      }
    }),
  },
  {
    keys: ["clipsContent"],
    ...guarded(hasAutoLayout, "clipping", (node, { clipsContent }) => {
      if (clipsContent !== undefined) {
        assign(node, "clipsContent", clipsContent);
      }
    }),
  },
  {
    keys: ["cornerRadius"],
    write: radius,
    check: (node, { cornerRadius }) => {
      if (Array.isArray(cornerRadius) ? !hasCornerSides(node) : !hasCorners(node)) {
        throw refusal(node, Array.isArray(cornerRadius) ? "radius per corner" : "corner radius");
      }
    },
  },
];

async function radius(node: SceneNode, { cornerRadius }: FigmaProps, scope: WriteScope): Promise<void> {
  if (Array.isArray(cornerRadius)) {
    if (!hasCornerSides(node)) {
      throw refusal(node, "radius per corner");
    }

    await writeLengths(node, CORNERS, cornerRadius, scope);
  } else if (cornerRadius !== undefined) {
    if (!hasCorners(node)) {
      throw refusal(node, "corner radius");
    }

    await writeLength(node, "cornerRadius", cornerRadius as LengthValue, scope);
  }
}
