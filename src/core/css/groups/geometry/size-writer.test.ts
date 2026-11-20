import { describe, expect, it } from "vitest";
import { SizeWriter } from "@/core/css/groups/geometry/size-writer.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const split = new CssSplit();
const writer = new SizeWriter(new CssLength(new CssVar(split), new NumberFormat(), new TokenNames()), split);

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

describe("SizeWriter", () => {
  // C-055: a layer fills its parent's direction or not.
  it("refuses a grow weight other than 0 or 1", () => {
    expect(written({ flex: "1" }).props).toEqual({ grow: true });
    expect(written({ flex: "none" }).props).toEqual({ grow: false });
    expect(written({ flex: "2" }).problems[0]?.message).toContain("Figma has no grow weights");
  });

  // C-056: none, auto and 0 take the limit away.
  it("removes a limit for none, auto and 0", () => {
    expect(written({ "min-width": "none", "max-width": "auto", "min-height": "0" }).props).toEqual({
      minWidth: null,
      maxWidth: null,
      minHeight: null,
    });
    expect(written({ "max-height": "120px" }).props).toEqual({ maxHeight: 120 });
  });
});
