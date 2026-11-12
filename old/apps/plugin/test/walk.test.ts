import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { layersUntil } from "../src/figma/walk.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        children: [
          {
            id: "1:2",
            type: "TEXT",
          },
          {
            id: "1:3",
            type: "INSTANCE",
            children: [
              {
                id: "I1:3;1:9",
                type: "TEXT",
              },
            ],
          },
        ],
      },
      {
        id: "1:4",
        type: "TEXT",
      },
    ],
  });

const ids = (layers: readonly BaseNode[]) => layers.map(({ id }) => id);

/** A layer of the installed page, as the plugin gets it. */
const layer = async (id: string) => (await figma.getNodeByIdAsync(id)) as BaseNode;

beforeEach(() => {
  installFigma(page());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("layersUntil", () => {
  it("walks the roots and their layers depth first, into the layers it is told to go into", async () => {
    const root = await layer("0:1");

    expect(ids(layersUntil([root], Number.POSITIVE_INFINITY).layers)).toEqual([
      "0:1",
      "1:1",
      "1:2",
      "1:3",
      "I1:3;1:9",
      "1:4",
    ]);
    expect(ids(layersUntil([root], Number.POSITIVE_INFINITY, (node) => node.type !== "INSTANCE").layers)).toEqual([
      "0:1",
      "1:1",
      "1:2",
      "1:3",
      "1:4",
    ]);
  });

  it("takes each layer once when one root holds another", async () => {
    expect(ids(layersUntil([await layer("1:1"), await layer("0:1")], Number.POSITIVE_INFINITY).layers)).toEqual([
      "1:1",
      "1:2",
      "1:3",
      "I1:3;1:9",
      "0:1",
      "1:4",
    ]);
  });

  it("stops at the deadline and says it did not reach every layer", async () => {
    const root = await layer("0:1");

    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const walked = layersUntil([root], 5_000);

    expect(walked.finished).toBe(false);
    expect(walked.layers).toEqual([]);
  });
});
