import { expect, it, vi } from "vitest";
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

const log = { warn: vi.fn() } as never;
const change = (fields: object) => ({ kind: "update", id: "1:2", tag: "Text", props: {}, ...fields }) as never;

// The plugin checks a family's axes; the catalogue's ranges go with the call for the families its axes go over.
it("asks the catalogue only for the families the changes' axes go over", async () => {
  const asked: string[] = [];
  const ranges = new FontRanges(
    {
      axes: async (family: string) => {
        asked.push(family);

        return family === "Lato" ? null : { wght: WGHT };
      },
    },
    log,
  );

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

// QA NEW-090: one catalogue request per family, all at once, and no more than a call's cap of families.
it("asks every family at once, and past the cap asks none: the axes' tags are checked alone, with a log line", async () => {
  let open = 0;
  let most = 0;
  const warn = vi.fn();
  const ranges = new FontRanges(
    {
      axes: async () => {
        most = Math.max(most, ++open);
        await new Promise((resolve) => setTimeout(resolve, 1));
        open--;

        return { wght: WGHT };
      },
    },
    { warn } as never,
  );
  // Each text names its own family, and the layer 1:2 is in Roboto Flex: one family more than the texts.
  const texts = (count: number) =>
    [...Array(count).keys()].map((index) =>
      change({ props: { font: { family: `Family ${index}` }, fontVariations: { wght: 500 } } }),
    );

  expect(Object.keys(await ranges.of(texts(19), layers))).toHaveLength(20);
  expect(most).toBe(20);
  expect(warn).not.toHaveBeenCalled();

  expect(await ranges.of(texts(20), layers)).toEqual({});
  expect(warn).toHaveBeenCalledOnce();
});
