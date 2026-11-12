import { describe, expect, it } from "vitest";
import { PlacementWriter } from "@/core/css/groups/geometry/placement-writer.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const writer = new PlacementWriter(new CssLength(new CssVar(new CssSplit()), new NumberFormat(), new TokenNames()));

type Attributes = Readonly<Record<string, string>>;

/** What the writer sets for an element's attributes over what the layer has now (`current`). */
function written(
  attributes: Attributes,
  current: Attributes = {},
  tag = "Frame",
) {
  const out = new ChangeOutput();

  writer.write(
    {
      tag,
      own: (name) => attributes[name],
      merged: (name) => attributes[name] ?? current[name],
      changed: (name) => attributes[name] !== undefined,
      hidden: false,
      existing: true,
    },
    out,
  );

  return { props: out.props, sources: out.sources, problems: out.problems };
}

describe("PlacementWriter", () => {
  // C-051: the element's edges replace the layer's as a pair.
  it("unpins the left edge when a new right edge is given", () => {
    const { props, sources } = written({ right: "0" }, { position: "absolute", left: "10px" });

    expect(props.horizontal).toEqual({ kind: "MAX", offset: 0 });
    expect(sources.horizontal).toBe("right");
  });

  // C-051: a size alone keeps the edge the layer is pinned to.
  it("keeps the pinned edge when only the size is given", () => {
    const { props } = written({ width: "50px" }, { position: "absolute", right: "8px", width: "20px" });

    expect(props).toEqual({ horizontal: { kind: "MAX", offset: 8 }, width: 50 });
  });

  // C-051: edges place only a layer placed absolutely; the hint says how.
  it("refuses edges on a layer that flows in its parent, with a hint", () => {
    const { problems } = written({ left: "4px" });

    expect(problems.map(({ attribute }) => attribute)).toEqual(["left"]);
    expect(problems[0]?.hint).toContain('position="absolute"');
  });

  // C-052: auto, fit-content and max-content hug the content; a percent needs its start edge in percents.
  it("writes auto, fit-content and max-content as hugging", () => {
    for (const value of ["auto", "fit-content", "max-content"]) {
      expect(written({ height: value }).props).toEqual({ height: "HUG" });
    }

    expect(written({ width: "50%" }).problems[0]?.hint).toContain("left in percents");
  });
});
