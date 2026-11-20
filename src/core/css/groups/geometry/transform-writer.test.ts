import { describe, expect, it } from "vitest";
import { TransformWriter } from "@/core/css/groups/geometry/transform-writer.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssAngle } from "@/core/css/values/css-angle.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const writer = new TransformWriter(new CssSplit(), new NumberFormat(), new CssAngle());

/** What the writer sets for an element's transform. */
function written(transform: string) {
  const out = new ChangeOutput();

  writer.write(
    {
      tag: "Frame",
      own: (name) => (name === "transform" ? transform : undefined),
      merged: (name) => (name === "transform" ? transform : undefined),
      changed: (name) => name === "transform",
      hidden: false,
      existing: true,
    },
    out,
  );

  return { props: out.props, problems: out.problems };
}

describe("TransformWriter", () => {
  // Item 37 QA: rotate(0deg) negated gave -0, which Figma props and goldens would show as a turn.
  it("writes rotate(0deg) as a rotation of 0, not -0", () => {
    expect(Object.is(written("rotate(0deg)").props.rotation, 0)).toBe(true);
  });

  // C-052: CSS turns clockwise and Figma counter-clockwise; every CSS angle unit reads, read by the gradients' reader.
  it("reads rotate() in every angle unit as Figma's counter-clockwise degrees, with the mirror", () => {
    expect(written("rotate(0.25turn) scaleX(-1)").props).toEqual({ rotation: -90, mirror: true });
    expect(written("rotate(100grad)").props).toEqual({ rotation: -90, mirror: false });
  });

  it("refuses a rotate() without an angle unit", () => {
    expect(written("rotate(5)").problems).toHaveLength(1);
  });
});
