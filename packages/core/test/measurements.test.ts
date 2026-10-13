import { describe, expect, it } from "vitest";
import { designMeasurements, type Snapshot, type SnapshotNode } from "../src/index.ts";

const layer = (id: string, x: number, y: number, width: number, height: number): SnapshotNode => ({
  id,
  name: id,
  type: "FRAME",
  visible: true,
  x,
  y,
  width,
  height,
  childCount: 0,
});

const card = (measurements: Snapshot["measurements"]): Snapshot => ({
  root: {
    ...layer("1:1", 0, 0, 400, 300),
    childCount: 2,
    children: [
      layer("1:2", 0, 0, 100, 50),
      {
        ...layer("1:3", 124, 80, 100, 50),
        rotation: 90,
        bounds: {
          x: 130,
          y: 80,
          width: 50,
          height: 100,
        },
      },
    ],
  },
  styles: {},
  variables: {},
  ...(measurements === undefined ? {} : { measurements }),
});

const side = (id: string, at: "TOP" | "RIGHT" | "BOTTOM" | "LEFT") => ({
  id,
  side: at,
});

describe("Dev Mode measurements in a read", () => {
  it("gives the distance between the two measured sides, from the read's boxes", () => {
    expect(
      designMeasurements(
        card([
          {
            start: side("1:2", "RIGHT"),
            end: side("1:3", "LEFT"),
          },
          {
            start: side("1:2", "BOTTOM"),
            end: side("1:3", "TOP"),
            text: "space above the badge",
          },
          {
            start: side("1:1", "LEFT"),
            end: side("1:2", "LEFT"),
          },
        ]),
      ),
    ).toEqual([
      {
        from: "1:2 right",
        to: "1:3 left",
        px: 30,
      },
      {
        from: "1:2 bottom",
        to: "1:3 top",
        px: 30,
        text: "space above the badge",
      },
      {
        from: "1:1 left",
        to: "1:2 left",
        px: 0,
      },
    ]);
  });

  it("names a side the read does not hold by its id, without a distance", () => {
    expect(
      designMeasurements(
        card([
          {
            start: side("1:2", "RIGHT"),
            end: side("9:9", "LEFT"),
          },
        ]),
      ),
    ).toEqual([
      {
        from: "1:2 right",
        to: "9:9 left",
      },
    ]);
  });

  it("gives nothing for a read without measurements", () => {
    expect(designMeasurements(card(undefined))).toEqual([]);
  });
});
