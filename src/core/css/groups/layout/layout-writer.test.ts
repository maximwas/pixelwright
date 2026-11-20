import { describe, expect, it } from "vitest";
import { GapReader } from "@/core/css/groups/layout/gap-reader.ts";
import { GridWriter } from "@/core/css/groups/layout/grid-writer.ts";
import { LayoutWriter } from "@/core/css/groups/layout/layout-writer.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const split = new CssSplit();
const lengths = new CssLength(new CssVar(split), new NumberFormat(), new TokenNames());
const gaps = new GapReader(lengths, split);
const writer = new LayoutWriter(lengths, split, gaps, new GridWriter(lengths, split, gaps));

type Attributes = Readonly<Record<string, string>>;

/** What the writer sets for an element's attributes over what the layer has now (`current`); `same`: not changed. */
function written(
  attributes: Attributes,
  current: Attributes = {},
  extra: { tag?: string; same?: string[]; hidden?: boolean } = {},
) {
  const out = new ChangeOutput();

  writer.write(
    {
      tag: extra.tag ?? "Frame",
      own: (name) => attributes[name],
      merged: (name) => attributes[name] ?? current[name],
      changed: (name) => attributes[name] !== undefined && !(extra.same ?? []).includes(name),
      hidden: extra.hidden ?? false,
      existing: true,
    },
    out,
  );

  return { props: out.props, failed: out.problems.map(({ attribute }) => attribute) };
}

describe("LayoutWriter", () => {
  // C-034, O-017: gap is rows then columns, and a gap given resets the longhands the layer has.
  it("lets the gap shorthand reset the row and column gaps the layer has", () => {
    const { props } = written(
      { gap: "12px" },
      { display: "flex", "flex-wrap": "wrap", "column-gap": "8px", "row-gap": "4px" },
    );

    expect(props).toMatchObject({ layoutMode: "HORIZONTAL", itemSpacing: 12, counterAxisSpacing: 12 });
  });

  it("spaces a row by its column gap and a column by its row gap", () => {
    expect(written({ gap: "4px 9px" }, { display: "flex" }).props).toMatchObject({ itemSpacing: 9 });
    expect(written({ gap: "4px 9px" }, { display: "flex", "flex-direction": "column" }).props).toMatchObject({
      layoutMode: "VERTICAL",
      itemSpacing: 4,
    });
  });

  // C-039, O-033: padding-top alone keeps the sides the layer has.
  it("writes padding-top alone over the padding the layer has", () => {
    expect(written({ "padding-top": "5px" }, { padding: "10px 20px" }).props.padding).toEqual([5, 20, 10, 20]);
    expect(written({ padding: "8px", "padding-left": "1px" }).props.padding).toEqual([8, 8, 8, 1]);
  });

  // C-037, B-049: tracks go only when the call changes them or the frame just became a grid.
  it("resends grid tracks only when they changed", () => {
    const grid = { display: "grid", "grid-template-columns": "1fr 1fr", "grid-template-rows": "auto" };

    expect(written({ gap: "8px" }, grid).props).toEqual({ layoutMode: "GRID", gridColumnGap: 8, gridRowGap: 8 });
    expect(written({ "grid-template-rows": "20px" }, grid).props.gridRows).toEqual([{ type: "FIXED", value: 20 }]);
    expect(written({ display: "grid" }, { "grid-template-columns": "repeat(3, 1fr)" }).props.gridColumns).toHaveLength(
      3,
    );
  });

  // C-036, C-038: no reverse order in auto layout, no flex alignment on a grid, no tracks on flex.
  it("refuses what Figma has no word for", () => {
    expect(written({ display: "flex", "flex-direction": "row-reverse" }).failed).toEqual(["flex-direction"]);
    expect(written({ "justify-content": "center" }, { display: "grid" }).failed).toEqual(["justify-content"]);
    expect(written({ display: "flex", "grid-template-columns": "1fr" }).failed).toEqual(["grid-template-columns"]);
    expect(written({ display: "grid", "flex-wrap": "wrap" }).failed).toEqual(["flex-wrap"]);
    expect(written({ gap: "4px" }).failed).toEqual(["gap"]);
  });

  // C-035, C-040: display absent is block, none hides and keeps the layout, inline words are the block ones.
  it("reads the display words over the merged values", () => {
    expect(written({ display: "inline-flex" }).props.layoutMode).toBe("HORIZONTAL");
    expect(written({ display: "none" }).props).toEqual({ visible: false });
    expect(written({ display: "block" }, { display: "flex" }).props).toEqual({ layoutMode: "NONE" });
    expect(written({ display: "flex" }, {}, { hidden: true }).props).toMatchObject({ visible: true });
    expect(written({ "justify-content": "space-between" }).props.primaryAxisAlignItems).toBe("SPACE_BETWEEN");
  });
});
