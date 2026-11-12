import { describe, expect, it } from "vitest";
import { GridCellWriter } from "@/core/css/groups/geometry/grid-cell-writer.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";

const writer = new GridCellWriter();

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

describe("GridCellWriter", () => {
  // C-058: lines counted from 1, `N / span M` or `N / M`; a bad grid-row is grid-row's error, not grid-column's.
  it("names grid-row in its error when grid-column is given too", () => {
    const { props, problems } = written({ "grid-row": "0 / span 2", "grid-column": "2 / 4" });

    expect(problems.map(({ attribute }) => attribute)).toEqual(["grid-row"]);
    expect(problems[0]?.message).toContain('grid-row="0 / span 2"');
    expect(props).toEqual({ gridColumn: { anchor: 1, span: 2 } });
    expect(written({ "grid-row": "3", "justify-self": "end" }).props).toEqual({
      gridRow: { anchor: 2, span: 1 },
      justifySelf: "MAX",
    });
  });
});
