import { describe, expect, it } from "vitest";
import { AppearanceWriter } from "@/core/css/groups/appearance/appearance-writer.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const split = new CssSplit();
const writer = new AppearanceWriter(new CssLength(new CssVar(split), new NumberFormat(), new TokenNames()), split);

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

describe("AppearanceWriter", () => {
  it("refuses a blend word that is an inherited property name", () => {
    const { props, problems } = written({ "mix-blend-mode": "constructor" });

    expect(props).toEqual({});
    expect(problems.map(({ attribute }) => attribute)).toEqual(["mix-blend-mode"]);
  });

  // C-070..C-073: opacity as a number or percent held to 0..1, blend modes by CSS name, corners as one or four.
  it("writes opacity, the blend mode and the corners in Figma's terms", () => {
    expect(written({ opacity: "50%" }).props).toEqual({ opacity: 0.5 });
    expect(written({ opacity: "2" }).props).toEqual({ opacity: 1 });
    expect(written({ "mix-blend-mode": "plus-darker" }).props).toEqual({ blendMode: "LINEAR_BURN" });
    expect(written({ "border-radius": "4px 8px" }).props).toEqual({ cornerRadius: [4, 8, 4, 8] });
    expect(written({ "border-radius": "50%" }, {}, "Ellipse").props).toEqual({});
  });

  // A frame clips its content; a text truncates on one line, and truncation on a frame is an error.
  it("clips a frame and truncates a text", () => {
    expect(written({ overflow: "hidden" }).props).toEqual({ clipsContent: true });
    expect(written({ "text-overflow": "ellipsis" }, {}, "Text").props).toEqual({ truncate: true });
    expect(written({ "text-overflow": "ellipsis" }).problems.map(({ attribute }) => attribute)).toEqual([
      "text-overflow",
    ]);
    expect(written({ overflow: "scroll" }).problems[0]?.message).toContain("prototype setting");
  });
});
