import { describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { tokenIndex } from "../src/figma/token-index.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

/** Two of the file's paint styles named Black, as a real file had them (#0F0F0F and #141414). */
const blackStyle = (id: string, level: number) => ({
  id,
  name: "Black",
  type: "PAINT",
  remote: false,
  paints: [
    {
      type: "SOLID",
      visible: true,
      opacity: 1,
      color: {
        r: level,
        g: level,
        b: level,
      },
    },
  ],
});
const FIRST = blackStyle("S:1", 15 / 255);
const SECOND = blackStyle("S:2", 20 / 255);

const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        type: "RECTANGLE",
        fills: [
          {
            type: "SOLID",
            visible: true,
            opacity: 1,
            color: {
              r: 20 / 255,
              g: 20 / 255,
              b: 20 / 255,
            },
          },
        ],
        fillStyleId: "S:2",
      },
    ],
  });

const library = {
  styles: {
    "S:1": FIRST,
    "S:2": SECOND,
  },
  localStyles: { paint: [SECOND, FIRST] },
};

describe("styles that share a name", () => {
  it("are numbered in tokens_read: the second Black is --Black-2", async () => {
    installFigma(page(), library);

    const tokens = (await runOperation("variables", { used: false })) as {
      styles: { id: string; duplicate?: number }[];
    };

    expect(tokens.styles.map(({ id, duplicate }) => [id, duplicate])).toEqual([
      ["S:2", 2],
      ["S:1", undefined],
    ]);
  });

  it("are numbered in a snapshot, though only the second is used", async () => {
    installFigma(page(), library);

    const snapshot = (await runOperation("snapshot", { node: "1:1" })) as {
      styles: Record<string, { duplicate?: number }>;
    };

    expect(snapshot.styles["S:2"]?.duplicate).toBe(2);
  });

  it("are found apart by design_apply's token lookup", async () => {
    installFigma(page(), library);

    const index = await tokenIndex();

    expect(await index.style("--Black", "PAINT")).toBe("S:1");
    expect(await index.style("--Black-2", "PAINT")).toBe("S:2");
  });
});

/** Two library styles named Black, as team files have them: which one is --Black-2 must not depend on what is read. */
const LIBRARY_A = {
  ...blackStyle("S:a", 15 / 255),
  remote: true,
};
const LIBRARY_B = {
  ...blackStyle("S:b", 20 / 255),
  remote: true,
};
const filled = (id: string, styleId: string) => ({
  id,
  type: "RECTANGLE",
  fills: [],
  fillStyleId: styleId,
});
const teamLibrary = (pages: ReturnType<typeof tree>[] = []) => ({
  styles: {
    "S:a": LIBRARY_A,
    "S:b": LIBRARY_B,
  },
  pages,
});

describe("library styles that share a name", () => {
  it("get the same numbers in a snapshot of one layer, design_apply's entries, tokens_read within it and the lookup", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [filled("1:1", "S:a"), filled("1:2", "S:b")],
      }),
      teamLibrary(),
    );

    const read = (await runOperation("snapshot", { node: "1:2" })) as {
      styles: Record<string, { duplicate?: number }>;
    };
    const entries = (await runOperation("entries", { ids: ["1:2"] })) as {
      styles: Record<string, { duplicate?: number }>;
    };
    const tokens = (await runOperation("variables", {
      used: true,
      within: "1:2",
    })) as { styles: { id: string; duplicate?: number }[] };
    const index = await tokenIndex();

    expect(read.styles["S:b"]?.duplicate).toBe(2);
    expect(entries.styles["S:b"]?.duplicate).toBe(2);
    expect(tokens.styles.find((style) => style.id === "S:b")?.duplicate).toBe(2);
    expect(await index.style("--Black", "PAINT")).toBe("S:a");
    expect(await index.style("--Black-2", "PAINT")).toBe("S:b");
  });

  it("keep their meaning in the lookup after it looked on the other pages for another name", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [filled("1:1", "S:a")],
      }),
      teamLibrary([
        tree({
          id: "0:2",
          type: "PAGE",
          children: [filled("2:1", "S:b")],
        }),
      ]),
    );

    const index = await tokenIndex();

    expect(await index.style("--Nope", "PAINT")).toBeNull();
    expect(await index.style("--Black", "PAINT")).toBe("S:a");
  });
});
