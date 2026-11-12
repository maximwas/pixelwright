import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { Measurements } from "@/core/inspect/measurements.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

const layer = (id: string, box: { x: number; y: number; width: number; height: number }) => ({
  id,
  name: id,
  type: "FRAME",
  visible: true,
  ...box,
  childCount: 0,
});

/** A card with a frame at its corner and a turned one, whose box is its bounds. */
const card = (measurements?: ReadModel["measurements"]): ReadModel =>
  zod.parse(ReadModelSchema, {
    root: {
      ...layer("1:1", { x: 0, y: 0, width: 400, height: 300 }),
      childCount: 2,
      children: [
        layer("1:2", { x: 0, y: 0, width: 100, height: 50 }),
        {
          ...layer("1:3", { x: 124, y: 80, width: 100, height: 50 }),
          rotation: 90,
          bounds: { x: 130, y: 80, width: 50, height: 100 },
        },
      ],
    },
    styles: {},
    variables: {},
    ...(measurements === undefined ? {} : { measurements }),
  });

const measurements = new Measurements(new NumberFormat());

describe("Dev Mode measurements in a read (T-061)", () => {
  it("gives the distance between the two measured sides, from the read's boxes", () => {
    expect(
      measurements.read(
        card([
          { start: { id: "1:2", side: "RIGHT" }, end: { id: "1:3", side: "LEFT" } },
          { start: { id: "1:2", side: "BOTTOM" }, end: { id: "1:3", side: "TOP" }, text: "space above the badge" },
          { start: { id: "1:1", side: "LEFT" }, end: { id: "1:2", side: "LEFT" } },
        ]),
      ),
    ).toEqual([
      { from: "1:2 right", to: "1:3 left", px: 30 },
      { from: "1:2 bottom", to: "1:3 top", px: 30, text: "space above the badge" },
      { from: "1:1 left", to: "1:2 left", px: 0 },
    ]);
  });

  it("names a side the read does not hold by its id, without a distance", () => {
    expect(
      measurements.read(card([{ start: { id: "1:2", side: "RIGHT" }, end: { id: "9:9", side: "LEFT" } }])),
    ).toEqual([{ from: "1:2 right", to: "9:9 left" }]);
  });

  it("gives nothing for a read without measurements", () => {
    expect(measurements.read(card())).toEqual([]);
  });
});
