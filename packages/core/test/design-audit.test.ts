import { describe, expect, it } from "vitest";
import { designAudit, type SnapshotNode, type TextSegment } from "../src/index.ts";

const solid = (hex: number) => ({
  type: "SOLID",
  visible: true,
  color: {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  },
});

const box = (id: string, fields: Partial<SnapshotNode>): SnapshotNode => ({
  id,
  name: id,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const text = (id: string, size: number): SnapshotNode => {
  const segment: TextSegment = {
    characters: id,
    start: 0,
    end: id.length,
    fontName: {
      family: "Inter",
      style: "Regular",
    },
    fontSize: size,
    fontWeight: 400,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: {
      unit: "PIXELS",
      value: 20,
    },
    letterSpacing: {
      unit: "PIXELS",
      value: 0,
    },
    fills: [solid(0x191a23)],
    fillStyleId: "S:d",
    textStyleId: "",
  };

  return box(id, {
    type: "TEXT",
    text: {
      characters: id,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [segment],
    },
  });
};

describe("design_audit", () => {
  it("lists the scale in use and what is off it: the 4px grid, raw token colours, near twins", () => {
    const audit = designAudit({
      root: box("1:1", {
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        paddingTop: 13,
        cornerRadius: 8,
        fills: [solid(0x191a23)],
        children: [
          box("1:2", {
            layoutMode: "HORIZONTAL",
            itemSpacing: 16,
            fills: [solid(0x191a24)],
            fillStyleId: "S:d",
          }),
          text("1:3", 14),
          text("1:4", 13),
        ],
      }),
      styles: {
        "S:d": {
          name: "Dark",
          type: "PAINT",
          remote: true,
          paints: [solid(0x191a24)],
        },
      },
      variables: {},
    });

    expect(audit.spacing).toEqual([
      {
        value: 13,
        count: 1,
      },
      {
        value: 16,
        count: 2,
      },
    ]);
    expect(audit.fontSizes.map((size) => size.value)).toEqual([13, 14]);
    expect(audit.colors).toContainEqual({
      value: "#191A23",
      count: 1,
    });
    expect(audit.notes.join("\n")).toMatch(/13px is off the 4px grid/);
    expect(audit.notes.join("\n")).toMatch(/13px and 14px font sizes are a pixel apart/);
    expect(audit.notes.join("\n")).toMatch(/#191A23 is a hair from --Dark \(#191A24\)/);
  });
});
