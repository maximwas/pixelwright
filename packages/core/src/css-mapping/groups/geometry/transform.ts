import { decimal, roundTo } from "../../../kernel/numbers.ts";
import type { SnapshotNode } from "../../../types/snapshot.ts";
import type { Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { splitTop } from "../../values/css-values.ts";

/**
 * A layer's turn and mirror as CSS. CSS turns clockwise, Figma counter-clockwise. A mirrored layer is its matrix times
 * a horizontal flip: the angle left once the flip is taken out, then scaleX(-1).
 */
export function transformCss(node: SnapshotNode): string | null {
  if (node.mirrorTransform !== undefined) {
    const [a = -1, b = 0] = node.mirrorTransform;
    const angle = Math.round(((Math.atan2(b, -a) * 180) / Math.PI) * 100) / 100;

    return angle === 0 ? "scaleX(-1)" : `rotate(${decimal(-angle)}deg) scaleX(-1)`;
  }

  const rotation = node.rotation ?? 0;

  return rotation === 0 ? null : `rotate(${decimal(-rotation)}deg)`;
}

/** The whole transform written back: a turn without scaleX(-1) also takes a mirror away. */
export const TRANSFORM_RULE: Rule = {
  attributes: ["transform"],
  write: transformRule,
};

function transformRule({ own }: WriteInput, out: WriteOutput): void {
  const value = own("transform") ?? "";
  let rotation = 0;
  let mirror = false;

  for (const part of value === "none" ? [] : splitTop(value, " ")) {
    const turn = /^rotate\(\s*(-?\d*\.?\d+)deg\s*\)$/.exec(part);

    if (turn !== null) {
      // CSS turns clockwise, Figma counter-clockwise.
      rotation = roundTo(-Number(turn[1]), 4);
    } else if (part === "scaleX(-1)") {
      mirror = true;
    } else {
      out.fail("transform", `transform part ${part} is not rotate(Ndeg) or scaleX(-1), which is all Figma keeps.`);

      return;
    }
  }

  out.set("rotation", rotation, "transform");
  out.set("mirror", mirror, "transform");
}
