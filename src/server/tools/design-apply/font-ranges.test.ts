import { expect, it } from "vitest";
import { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import { FontRanges } from "@/server/tools/design-apply/font-ranges.ts";

const WGHT = { min: 100, max: 900, default: 400 };

/** A read of one text in Roboto Flex. */
const layers = CurrentLayers.of(
  [
    {
      model: 1,
      profile: "apply",
      root: {
        id: "1:2",
        name: "Title",
        type: "TEXT",
        visible: true,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        childCount: 0,
        text: { segments: [{ fontName: { family: "Roboto Flex", style: "Regular" } }] },
      },
      styles: {},
      variables: {},
    } as never,
  ],
  [],
);

// The plugin checks a family's axes; the catalogue's ranges go with the call for the families its axes go over.
it("asks the catalogue only for the families the changes' axes go over", async () => {
  const asked: string[] = [];
  const ranges = new FontRanges({
    axes: async (family: string) => {
      asked.push(family);

      return family === "Lato" ? null : { wght: WGHT };
    },
  });
  const change = (fields: object) => ({ kind: "update", id: "1:2", tag: "Text", props: {}, ...fields }) as never;

  expect(
    await ranges.of(
      [
        change({ props: { fontVariations: { wght: 500 } } }),
        change({ props: { font: { family: "Lato" } }, text: { runs: [{ props: { fontVariations: {} } }] } }),
        change({ kind: "create", id: null, props: { fontVariations: {} } }),
        change({ props: { font: { family: "Unused" } } }),
      ],
      layers,
    ),
  ).toEqual({ "Roboto Flex": { wght: { min: 100, max: 900 } }, Inter: { wght: { min: 100, max: 900 } } });
  expect(asked).toEqual(["Roboto Flex", "Lato", "Inter"]);
  expect(await ranges.of([change({})], layers)).toEqual({});
});
