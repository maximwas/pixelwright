import { beforeEach, describe, expect, it } from "vitest";
import { setEditsAllowed } from "../src/figma/edits.ts";
import { runOperation } from "../src/figma/operations.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

const IMAGE = Uint8Array.from({ length: 10 }, (_, index) => index);
let exports: unknown[];

beforeEach(() => {
  exports = [];

  const page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "2:4869",
        absoluteBoundingBox: {
          x: 0,
          y: 0,
          width: 1440,
          height: 8000,
        },
      },
    ],
  });
  const { figma } = installFigma(page);
  const node = page.children?.[0] as unknown as Record<string, unknown>;

  node.exportAsync = async (settings: unknown) => {
    exports.push(settings);

    return IMAGE;
  };
  Object.assign(figma, {
    base64Encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
  });
});

const chunk = (offset: number, extra: object = {}) =>
  runOperation("export", {
    node: "2:4869",
    format: "PNG",
    offset,
    length: 4,
    ...extra,
  }) as Promise<{ totalBytes: number; bytes: string }>;

describe("export", () => {
  it("renders once and serves the later chunks of the same export from memory", async () => {
    const parts = [await chunk(0), await chunk(4), await chunk(8)];

    expect(exports).toEqual([
      {
        format: "PNG",
        constraint: {
          type: "SCALE",
          value: 1,
        },
        useAbsoluteBounds: false,
      },
    ]);
    expect(parts.map((part) => part.totalBytes)).toEqual([10, 10, 10]);
    expect(parts.map((part) => atob(part.bytes)).join("")).toBe(String.fromCharCode(...IMAGE));
  });

  it("renders again for a new export, so a changed layer is never served stale", async () => {
    await chunk(0);
    await chunk(0, { effects: false });

    expect(exports).toHaveLength(2);
    expect(exports[1]).toMatchObject({ useAbsoluteBounds: true });
  });

  it("lowers the scale so the longer side fits maxSide, and says which scale it used", async () => {
    const part = await chunk(0, {
      scale: 2,
      maxSide: 2_000,
    });

    expect(exports[0]).toMatchObject({
      constraint: {
        type: "SCALE",
        value: 0.25,
      },
    });
    expect(part).toMatchObject({ scale: 0.25 });
  });

  it("keeps the scale asked for when the image fits", async () => {
    const part = await chunk(0, {
      scale: 0.2,
      maxSide: 2_000,
    });

    expect(part).toMatchObject({ scale: 0.2 });
  });
});

describe("image", () => {
  it("sends the image as placed, by its hash, in chunks", async () => {
    const original = Uint8Array.from({ length: 6 }, (_, index) => 100 + index);

    Object.assign(figma, {
      getImageByHash: (hash: string) => (hash === "a".repeat(40) ? { getBytesAsync: async () => original } : null),
    });

    const first = (await runOperation("image", {
      hash: "a".repeat(40),
      length: 4,
    })) as {
      totalBytes: number;
      bytes: string;
    };
    const second = (await runOperation("image", {
      hash: "a".repeat(40),
      offset: 4,
      length: 4,
    })) as { bytes: string };

    expect(first.totalBytes).toBe(6);
    expect(atob(first.bytes) + atob(second.bytes)).toBe(String.fromCharCode(...original));
    await expect(runOperation("image", { hash: "b".repeat(40) })).rejects.toThrow(/No image/);
  });
});

describe("exports read at the same time", () => {
  it("serves each export's chunks from its own render, and renders afresh when a layer changed", async () => {
    let version = 0;
    const node = (
      globalThis as unknown as { figma: { getNodeByIdAsync: (id: string) => Promise<Record<string, unknown>> } }
    ).figma;
    const layer = await node.getNodeByIdAsync("2:4869");

    layer.exportAsync = async (settings: { format: string }) => {
      version += 1;

      return Uint8Array.from({ length: 8 }, () => (settings.format === "SVG" ? 200 : version));
    };

    const read = (stream: string, format: string, offset: number) =>
      runOperation("export", {
        node: "2:4869",
        format,
        offset,
        length: 4,
        stream,
      }) as Promise<{ bytes: string }>;
    const png = await read("a", "PNG", 0);
    const svg = await read("b", "SVG", 0);
    const pngRest = await read("a", "PNG", 4);

    expect(atob(png.bytes) + atob(pngRest.bytes)).toBe(String.fromCharCode(...Array(8).fill(1)));
    expect(atob(svg.bytes)).toBe(String.fromCharCode(...Array(4).fill(200)));

    const again = await read("c", "PNG", 0);

    expect(atob(again.bytes)).toBe(String.fromCharCode(...Array(4).fill(3)));
  });
});

describe("export in a variable mode", () => {
  const themed = (allowEdits: boolean) => {
    const page = tree({
      id: "0:1",
      type: "PAGE",
      children: [
        {
          id: "4:1",
          name: "Card",
          absoluteBoundingBox: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        },
      ],
    });
    const installed = installFigma(page, {
      collections: {
        "C:1": {
          id: "C:1",
          name: "Theme",
          modes: [
            {
              modeId: "m:1",
              name: "Light",
            },
            {
              modeId: "m:2",
              name: "Dark",
            },
          ],
        },
      },
    });
    const node = page.children?.[0] as unknown as Record<string, unknown>;
    const seen: unknown[] = [];

    node.resolvedVariableModes = { "C:1": "m:1" };
    node.explicitVariableModes = {};
    node.setExplicitVariableModeForCollection = (collection: { id: string }, mode: string) => {
      (node.explicitVariableModes as Record<string, string>)[collection.id] = mode;
    };
    node.clearExplicitVariableModeForCollection = (collection: { id: string }) => {
      delete (node.explicitVariableModes as Record<string, string>)[collection.id];
    };
    node.exportAsync = async () => {
      seen.push({ ...(node.explicitVariableModes as object) });

      return IMAGE;
    };
    Object.assign(installed.figma, {
      base64Encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
    });
    setEditsAllowed(allowEdits);

    return {
      node,
      seen,
      writes: installed.writes,
    };
  };

  it("renders the layer in the mode asked for and leaves its modes as they were, in one undo step", async () => {
    const { node, seen, writes } = themed(true);

    await runOperation("export", {
      node: "4:1",
      format: "PNG",
      offset: 0,
      length: 4,
      modes: { theme: "dark" },
    });

    expect(seen).toEqual([{ "C:1": "m:2" }]);
    expect(node.explicitVariableModes).toEqual({});
    expect(writes.undo).toBe(1);
  });

  it("is refused while Allow edits is off: it writes, if only for a moment", async () => {
    themed(false);

    await expect(
      runOperation("export", {
        node: "4:1",
        format: "PNG",
        offset: 0,
        length: 4,
        modes: { Theme: "Dark" },
      }),
    ).rejects.toMatchObject({ code: "EDITS_DISABLED" });
  });
});
