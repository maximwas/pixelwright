import { describe, expect, it } from "vitest";
import { ElementWriter } from "@/core/css/groups/element/element-writer.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";

const writer = new ElementWriter(new NameValueList());

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

describe("ElementWriter", () => {
  // What an element says beyond CSS, written back: lists, notes, the property a layer makes, mask and asset.
  it("writes the element's own attributes in Figma's terms", () => {
    expect(written({ variant: "State=Hover, Size=L", note: "Dev: use the token | check it" }).props).toEqual({
      variant: { State: "Hover", Size: "L" },
      notes: [
        { category: "Dev", label: "use the token" },
        { category: null, label: "check it" },
      ],
    });
    expect(written({ visibleProp: "Show icon" }).sources).toEqual({ property: "visibleProp" });
    expect(written({ mask: "alpha" }).props).toEqual({ mask: { isMask: true, maskType: "ALPHA" } });
    expect(written({ src: "a.png" }, {}, "Image").props).toEqual({ asset: { kind: "image", src: "a.png" } });
  });

  it("refuses what it cannot read, with what to do", () => {
    expect(written({ props: "Label" }).problems[0]?.hint).toContain("backslash");
    expect(written({ src: "a.png" }).problems[0]?.hint).toContain('background="url(a.png)"');
    expect(written({ mask: "clip" }).problems.map(({ attribute }) => attribute)).toEqual(["mask"]);
  });
});
